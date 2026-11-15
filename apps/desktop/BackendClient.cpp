#include "BackendClient.h"

#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QUrl>
#include <QUrlQuery>
#include <QRegularExpression>
#include <string>

#ifdef Q_OS_WIN
#include <windows.h>
#include <wincred.h>
#endif

namespace {
const QString kProjectUrl = QStringLiteral("https://ruxkffkijhlihcbbpiar.supabase.co");
const QString kPublishableKey = QStringLiteral("sb_publishable_pit8uUxi0wq_t6srpMXPDw_NVkacQRv");
}

BackendClient::BackendClient(QObject *parent)
    : QObject(parent),
      m_baseUrl(qEnvironmentVariable("DECTOR_SUPABASE_URL", kProjectUrl)),
      m_publishableKey(qEnvironmentVariable("DECTOR_SUPABASE_PUBLISHABLE_KEY", kPublishableKey))
{
    connect(&m_refreshTimer, &QTimer::timeout, this, &BackendClient::refreshAccessToken);
    m_refreshToken = readStoredRefreshToken();
    if (!m_refreshToken.isEmpty()) {
        setStatus(QStringLiteral("Восстанавливаем защищённую сессию…"));
        refreshAccessToken();
    }
}

QString BackendClient::encoded(const QString &value)
{
    return QString::fromLatin1(QUrl::toPercentEncoding(value));
}

void BackendClient::setBusy(bool value)
{
    if (m_busy == value)
        return;
    m_busy = value;
    emit busyChanged();
}

void BackendClient::setStatus(const QString &value)
{
    if (m_status == value)
        return;
    m_status = value;
    emit statusChanged();
}

void BackendClient::request(const QByteArray &method, const QString &path,
                            const QJsonObject &body, bool authenticated,
                            Completion completion)
{
    QUrl url(m_baseUrl + path);
    QNetworkRequest req(url);
    req.setHeader(QNetworkRequest::ContentTypeHeader, QStringLiteral("application/json"));
    req.setRawHeader("apikey", m_publishableKey.toUtf8());
    req.setRawHeader("Accept", "application/json");
    if (authenticated && !m_accessToken.isEmpty())
        req.setRawHeader("Authorization", QByteArray("Bearer ") + m_accessToken.toUtf8());

    req.setTransferTimeout(20000);
    const QByteArray payload = body.isEmpty() ? QByteArray() : QJsonDocument(body).toJson(QJsonDocument::Compact);
    QNetworkReply *reply = m_network.sendCustomRequest(req, method, payload);
    connect(reply, &QNetworkReply::finished, this, [reply, completion = std::move(completion)]() mutable {
        const int code = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
        const QByteArray data = reply->readAll();
        const QString error = reply->error() == QNetworkReply::NoError
            ? QString() : reply->errorString();
        reply->deleteLater();
        completion(code, data, error);
    });
}

void BackendClient::acceptAuthResponse(const QByteArray &data)
{
    const QJsonObject json = QJsonDocument::fromJson(data).object();
    const QString access = json.value(QStringLiteral("access_token")).toString();
    if (access.isEmpty())
        return;

    const bool wasAuthenticated = authenticated();
    m_accessToken = access;
    const QString nextRefreshToken = json.value(QStringLiteral("refresh_token")).toString();
    if (!nextRefreshToken.isEmpty())
        m_refreshToken = nextRefreshToken;
    storeRefreshToken(m_refreshToken);
    const QJsonObject user = json.value(QStringLiteral("user")).toObject();
    m_userId = user.value(QStringLiteral("id")).toString();
    scheduleTokenRefresh(json.value(QStringLiteral("expires_in")).toInt(3600));
    if (!wasAuthenticated)
        emit authenticatedChanged();
    refreshProfile();
    loadConversations();
}

void BackendClient::scheduleTokenRefresh(int expiresInSeconds)
{
    if (m_refreshToken.isEmpty())
        return;
    const int delay = qMax(30000, (expiresInSeconds - 90) * 1000);
    m_refreshTimer.start(delay);
}

void BackendClient::signUp(const QString &email, const QString &password,
                           const QString &displayName)
{
    if (email.trimmed().isEmpty() || password.size() < 8 || displayName.trimmed().isEmpty()) {
        setStatus(QStringLiteral("Укажи почту, имя и пароль не короче 8 символов"));
        return;
    }
    setBusy(true);
    setStatus(QStringLiteral("Создаём аккаунт…"));
    request("POST", QStringLiteral("/auth/v1/signup"),
            {{QStringLiteral("email"), email.trimmed()},
             {QStringLiteral("password"), password},
             {QStringLiteral("data"), QJsonObject{{QStringLiteral("display_name"), displayName.trimmed()}}}},
            false,
            [this](int code, const QByteArray &data, const QString &error) {
        setBusy(false);
        if (code >= 200 && code < 300) {
            acceptAuthResponse(data);
            if (!authenticated())
                setStatus(QStringLiteral("Аккаунт создан. Подтверди почту, затем войди."));
            else
                setStatus(QStringLiteral("Аккаунт создан"));
        } else {
            const QString message = QJsonDocument::fromJson(data).object().value(QStringLiteral("msg")).toString();
            setStatus(message.isEmpty() ? (error.isEmpty() ? QStringLiteral("Не удалось создать аккаунт (%1)").arg(code) : error) : message);
        }
    });
}

void BackendClient::signIn(const QString &email, const QString &password)
{
    if (email.trimmed().isEmpty() || password.isEmpty()) {
        setStatus(QStringLiteral("Введи почту и пароль"));
        return;
    }
    setBusy(true);
    setStatus(QStringLiteral("Входим в аккаунт…"));
    request("POST", QStringLiteral("/auth/v1/token?grant_type=password"),
            {{QStringLiteral("email"), email.trimmed()},
             {QStringLiteral("password"), password}},
            false,
            [this](int code, const QByteArray &data, const QString &error) {
        setBusy(false);
        if (code >= 200 && code < 300) {
            acceptAuthResponse(data);
            setStatus(QStringLiteral("Вход выполнен"));
        } else {
            const QJsonObject json = QJsonDocument::fromJson(data).object();
            QString message = json.value(QStringLiteral("msg")).toString();
            if (message.isEmpty())
                message = json.value(QStringLiteral("message")).toString();
            setStatus(message.isEmpty() ? (error.isEmpty() ? QStringLiteral("Ошибка входа (%1)").arg(code) : error) : message);
        }
    });
}

void BackendClient::signOut()
{
    m_refreshTimer.stop();
    if (authenticated()) {
        request("POST", QStringLiteral("/auth/v1/logout"), {}, true,
                [](int, const QByteArray &, const QString &) {});
    }
    m_accessToken.clear();
    m_refreshToken.clear();
    clearStoredRefreshToken();
    m_userId.clear();
    m_username.clear();
    m_displayName.clear();
    m_bio.clear();
    m_conversations.clear();
    emit authenticatedChanged();
    emit profileChanged();
    emit conversationsChanged();
    setStatus(QStringLiteral("Вы вышли из аккаунта"));
}

void BackendClient::refreshAccessToken()
{
    if (m_refreshToken.isEmpty())
        return;
    request("POST", QStringLiteral("/auth/v1/token?grant_type=refresh_token"),
            {{QStringLiteral("refresh_token"), m_refreshToken}},
            false,
            [this](int code, const QByteArray &data, const QString &) {
        if (code >= 200 && code < 300) {
            acceptAuthResponse(data);
        } else {
            signOut();
            setStatus(QStringLiteral("Сессия истекла. Войди снова."));
        }
    });
}

void BackendClient::refreshProfile()
{
    if (!authenticated() || m_userId.isEmpty())
        return;
    request("GET", QStringLiteral("/rest/v1/profiles?select=username,display_name,bio&id=eq.") + encoded(m_userId),
            {}, true,
            [this](int code, const QByteArray &data, const QString &error) {
        if (code < 200 || code >= 300) {
            setStatus(error.isEmpty() ? QStringLiteral("Не удалось загрузить профиль (%1)").arg(code) : error);
            return;
        }
        const QJsonArray rows = QJsonDocument::fromJson(data).array();
        if (rows.isEmpty())
            return;
        const QJsonObject profile = rows.first().toObject();
        m_username = profile.value(QStringLiteral("username")).toString();
        m_displayName = profile.value(QStringLiteral("display_name")).toString();
        m_bio = profile.value(QStringLiteral("bio")).toString();
        emit profileChanged();
    });
}

void BackendClient::updateProfile(const QString &displayName, const QString &username, const QString &bio)
{
    static const QRegularExpression usernamePattern(QStringLiteral("^[A-Za-z0-9_]{3,32}$"));
    if (!authenticated())
        return;
    if (!usernamePattern.match(username).hasMatch()) {
        setStatus(QStringLiteral("Username: 3–32 символа, только латиница, цифры и _"));
        return;
    }
    setBusy(true);
    request("PATCH", QStringLiteral("/rest/v1/profiles?id=eq.") + encoded(m_userId),
            {{QStringLiteral("display_name"), displayName.trimmed()},
             {QStringLiteral("username"), username},
             {QStringLiteral("bio"), bio.trimmed()}},
            true,
            [this](int code, const QByteArray &, const QString &error) {
        setBusy(false);
        if (code >= 200 && code < 300) {
            setStatus(QStringLiteral("Профиль сохранён"));
            refreshProfile();
        } else {
            setStatus(error.isEmpty() ? QStringLiteral("Не удалось сохранить профиль (%1)").arg(code) : error);
        }
    });
}

void BackendClient::loadConversations()
{
    if (!authenticated() || m_userId.isEmpty())
        return;
    const QString path = QStringLiteral("/rest/v1/conversation_members?select=conversation_id,role,conversations(id,kind,title,updated_at,conversation_members(user_id,profiles(username,display_name)))&user_id=eq.")
                         + encoded(m_userId) + QStringLiteral("&order=joined_at.desc");
    request("GET", path, {}, true,
            [this](int code, const QByteArray &data, const QString &error) {
        if (code < 200 || code >= 300) {
            setStatus(error.isEmpty() ? QStringLiteral("Не удалось загрузить чаты (%1)").arg(code) : error);
            return;
        }
        QVariantList result;
        const QJsonArray rows = QJsonDocument::fromJson(data).array();
        for (const QJsonValue &value : rows) {
            const QJsonObject row = value.toObject();
            const QJsonObject conversation = row.value(QStringLiteral("conversations")).toObject();
            if (conversation.isEmpty())
                continue;
            QString peerName;
            const QJsonArray members = conversation.value(QStringLiteral("conversation_members")).toArray();
            for (const QJsonValue &memberValue : members) {
                const QJsonObject member = memberValue.toObject();
                if (member.value(QStringLiteral("user_id")).toString() == m_userId)
                    continue;
                const QJsonObject profile = member.value(QStringLiteral("profiles")).toObject();
                peerName = profile.value(QStringLiteral("display_name")).toString();
                if (peerName.isEmpty())
                    peerName = profile.value(QStringLiteral("username")).toString();
                if (!peerName.isEmpty())
                    break;
            }
            result.append(QVariantMap{
                {QStringLiteral("id"), conversation.value(QStringLiteral("id")).toString()},
                {QStringLiteral("kind"), conversation.value(QStringLiteral("kind")).toString()},
                {QStringLiteral("title"), conversation.value(QStringLiteral("title")).toString()},
                {QStringLiteral("peerName"), peerName},
                {QStringLiteral("role"), row.value(QStringLiteral("role")).toString()}
            });
        }
        m_conversations = result;
        emit conversationsChanged();
        setStatus(QStringLiteral("Чаты обновлены"));
    });
}

void BackendClient::createDirectConversation(const QString &username)
{
    if (!authenticated())
        return;
    if (username.trimmed().isEmpty()) {
        setStatus(QStringLiteral("Введи username пользователя"));
        return;
    }
    setBusy(true);
    request("POST", QStringLiteral("/rest/v1/rpc/create_direct_conversation"),
            {{QStringLiteral("p_username"), username.trimmed()}},
            true,
            [this](int code, const QByteArray &data, const QString &error) {
        setBusy(false);
        if (code >= 200 && code < 300) {
            setStatus(QStringLiteral("Личный чат открыт"));
            loadConversations();
        } else {
            const QJsonObject json = QJsonDocument::fromJson(data).object();
            const QString message = json.value(QStringLiteral("message")).toString();
            setStatus(message.isEmpty() ? (error.isEmpty() ? QStringLiteral("Не удалось создать чат (%1)").arg(code) : error) : message);
        }
    });
}

void BackendClient::loadMessages(const QString &conversationId)
{
    if (!authenticated() || conversationId.isEmpty())
        return;
    const QString path = QStringLiteral("/rest/v1/messages?select=id,sender_id,ciphertext,nonce,content_type,created_at,encryption_version,reply_to&conversation_id=eq.")
                         + encoded(conversationId) + QStringLiteral("&order=created_at.asc&limit=100");
    request("GET", path, {}, true,
            [this, conversationId](int code, const QByteArray &data, const QString &error) {
        if (code < 200 || code >= 300) {
            setStatus(error.isEmpty() ? QStringLiteral("Не удалось загрузить сообщения (%1)").arg(code) : error);
            return;
        }
        QVariantList result;
        const QJsonArray rows = QJsonDocument::fromJson(data).array();
        for (const QJsonValue &value : rows) {
            const QJsonObject message = value.toObject();
            result.append(QVariantMap{
                {QStringLiteral("id"), message.value(QStringLiteral("id")).toString()},
                {QStringLiteral("senderId"), message.value(QStringLiteral("sender_id")).toString()},
                {QStringLiteral("ciphertext"), message.value(QStringLiteral("ciphertext")).toString()},
                {QStringLiteral("nonce"), message.value(QStringLiteral("nonce")).toString()},
                {QStringLiteral("createdAt"), message.value(QStringLiteral("created_at")).toString()},
                {QStringLiteral("contentType"), message.value(QStringLiteral("content_type")).toString()}
            });
        }
        emit messagesLoaded(conversationId, result);
        setStatus(QStringLiteral("История загружена. Содержимое пока зашифровано."));
    });
}

QString BackendClient::readStoredRefreshToken() const
{
#ifdef Q_OS_WIN
    const std::wstring target = L"Dector2/SupabaseSession";
    PCREDENTIALW credential = nullptr;
    if (!CredReadW(target.c_str(), CRED_TYPE_GENERIC, 0, &credential))
        return {};
    const QString token = QString::fromUtf8(
        reinterpret_cast<const char *>(credential->CredentialBlob),
        static_cast<qsizetype>(credential->CredentialBlobSize));
    CredFree(credential);
    return token;
#else
    return {};
#endif
}

void BackendClient::storeRefreshToken(const QString &token) const
{
#ifdef Q_OS_WIN
    if (token.isEmpty())
        return;
    const std::wstring target = L"Dector2/SupabaseSession";
    const QByteArray bytes = token.toUtf8();
    CREDENTIALW credential{};
    credential.Type = CRED_TYPE_GENERIC;
    credential.TargetName = const_cast<LPWSTR>(target.c_str());
    credential.CredentialBlobSize = static_cast<DWORD>(bytes.size());
    credential.CredentialBlob = reinterpret_cast<LPBYTE>(
        const_cast<char *>(bytes.constData()));
    credential.Persist = CRED_PERSIST_LOCAL_MACHINE;
    credential.UserName = const_cast<LPWSTR>(L"Dector");
    CredWriteW(&credential, 0);
#else
    Q_UNUSED(token);
#endif
}

void BackendClient::clearStoredRefreshToken() const
{
#ifdef Q_OS_WIN
    const std::wstring target = L"Dector2/SupabaseSession";
    CredDeleteW(target.c_str(), CRED_TYPE_GENERIC, 0);
#endif
}
