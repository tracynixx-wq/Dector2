#include <QGuiApplication>
#include <QQmlApplicationEngine>
#include <QUrl>

int main(int argc, char *argv[])
{
    QGuiApplication app(argc, argv);
    QGuiApplication::setApplicationName(QStringLiteral("Dector"));
    QGuiApplication::setOrganizationName(QStringLiteral("Dector"));
    QGuiApplication::setApplicationVersion(QStringLiteral("0.1.0"));

    QQmlApplicationEngine engine;
    const QUrl mainUrl(QStringLiteral("qrc:/qt/qml/Dector/apps/desktop/qml/Main.qml"));
    QObject::connect(
        &engine,
        &QQmlApplicationEngine::objectCreationFailed,
        &app,
        [] { QCoreApplication::exit(EXIT_FAILURE); },
        Qt::QueuedConnection);
    engine.load(mainUrl);

    return app.exec();
}
