#pragma once

#include <QObject>
#include <QJsonObject>
#include <QNetworkAccessManager>
#include <QVariantList>
#include <QTimer>
#include <functional>

class BackendClient final : public QObject
{
    Q_OBJECT
    Q_PROPERTY(bool authenticated READ authenticated NOTIFY authenticatedChanged)
    Q_PROPERTY(bool busy READ busy NOTIFY busyChanged)
    Q_PROPERTY(QString status READ status NOTIFY statusChanged)
    Q_PROPERTY(QString username READ username NOTIFY profileChanged)
    Q_PROPERTY(QString displayName READ displayName NOTIFY profileChanged)
    Q_PROPERTY(QString bio READ bio NOTIFY profileChanged)
    Q_PROPERTY(QVariantList conversations READ conversations NOTIFY conversationsChanged)

public:
    explicit BackendClient(QObject *parent = nullptr);

    bool authenticated() const { return !m_accessToken.isEmpty(); }
    bool busy() const { return m_busy; }
    QString status() const { return m_status; }
    QString username() const { return m_username; }
    QString displayName() const { return m_displayName; }
    QString bio() const { return m_bio; }
    QVariantList conversations() const { return m_conversations; }

    Q_INVOKABLE void signUp(const QString &email, const QString &password,
                            const QString &displayName);
    Q_INVOKABLE void signIn(const QString &email, const QString &password);
    Q_INVOKABLE void signOut();
    Q_INVOKABLE void refreshProfile();
    Q_INVOKABLE void updateProfile(const QString &displayName,
                                   const QString &username,
                                   const QString &bio);
    Q_INVOKABLE void loadConversations();
    Q_INVOKABLE void createDirectConversation(const QString &username);
    Q_INVOKABLE void loadMessages(const QString &conversationId);

signals:
    void authenticatedChanged();
    void busyChanged();
    void statusChanged();
    void profileChanged();
    void conversationsChanged();
    void messagesLoaded(const QString &conversationId, const QVariantList &messages);

private:
    using Completion = std::function<void(int, const QByteArray &, const QString &)>;

    void request(const QByteArray &method, const QString &path,
                 const QJsonObject &body, bool authenticated,
                 Completion completion);
    void setBusy(bool value);
    void setStatus(const QString &value);
    void acceptAuthResponse(const QByteArray &data);
    void refreshAccessToken();
    void scheduleTokenRefresh(int expiresInSeconds);
    QString readStoredRefreshToken() const;
    void storeRefreshToken(const QString &token) const;
    void clearStoredRefreshToken() const;
    static QString encoded(const QString &value);

    QNetworkAccessManager m_network;
    QTimer m_refreshTimer;
    QString m_baseUrl;
    QString m_publishableKey;
    QString m_accessToken;
    QString m_refreshToken;
    QString m_userId;
    QString m_username;
    QString m_displayName;
    QString m_bio;
    QString m_status = QStringLiteral("Подключение к Dector готово");
    QVariantList m_conversations;
    bool m_busy = false;
};
