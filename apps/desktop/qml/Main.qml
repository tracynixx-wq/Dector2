import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: window
    width: 1240
    height: 800
    minimumWidth: 980
    minimumHeight: 660
    visible: true
    title: qsTr("Dector")
    color: "#0a0d14"

    property string selectedConversationId: ""
    property string selectedConversationTitle: qsTr("Выбери чат")
    property var currentMessages: []

    Timer {
        interval: 15000
        repeat: true
        running: backend.authenticated
        onTriggered: backend.loadConversations()
    }

    Timer {
        interval: 8000
        repeat: true
        running: backend.authenticated && window.selectedConversationId !== ""
        onTriggered: backend.loadMessages(window.selectedConversationId)
    }

    Connections {
        target: backend
        function onMessagesLoaded(conversationId, messages) {
            if (conversationId === window.selectedConversationId)
                window.currentMessages = messages
        }
    }

    component PrimaryButton: Button {
        id: control
        property color accent: "#718cff"
        implicitHeight: 46
        contentItem: Text {
            text: control.text
            color: "#ffffff"
            font.pixelSize: 14
            font.weight: Font.DemiBold
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
            elide: Text.ElideRight
        }
        background: Rectangle {
            radius: 13
            color: control.enabled ? (control.down ? "#526bd2" : control.accent) : "#293246"
            Behavior on color { ColorAnimation { duration: 140 } }
        }
    }

    component Surface: Pane {
        background: Rectangle {
            color: "#111722"
            radius: 18
            border.color: "#202a3a"
            border.width: 1
        }
    }

    component Field: TextField {
        implicitHeight: 48
        color: "#edf2ff"
        placeholderTextColor: "#738098"
        leftPadding: 14
        rightPadding: 14
        font.pixelSize: 14
        background: Rectangle {
            radius: 12
            color: "#0c121d"
            border.color: parent.activeFocus ? "#718cff" : "#293449"
            Behavior on border.color { ColorAnimation { duration: 120 } }
        }
    }

    component SectionLabel: Label {
        color: "#8c9ab0"
        font.pixelSize: 11
        font.weight: Font.DemiBold
    }

    Rectangle {
        anchors.fill: parent
        gradient: Gradient {
            GradientStop { position: 0; color: "#101a2a" }
            GradientStop { position: 0.48; color: "#0a0d14" }
            GradientStop { position: 1; color: "#111323" }
        }
    }

    Item {
        anchors.fill: parent
        visible: !backend.authenticated

        Surface {
            width: 430
            anchors.centerIn: parent
            padding: 30
            height: authColumn.implicitHeight + 60

            ColumnLayout {
                id: authColumn
                anchors.fill: parent
                spacing: 15

                Label {
                    text: "D"
                    color: "#91a7ff"
                    font.pixelSize: 42
                    font.bold: true
                    Layout.alignment: Qt.AlignHCenter
                }
                Label {
                    text: qsTr("Добро пожаловать в Dector")
                    color: "#f3f6ff"
                    font.pixelSize: 22
                    font.weight: Font.DemiBold
                    Layout.alignment: Qt.AlignHCenter
                }
                Label {
                    text: qsTr("Твой личный мессенджер")
                    color: "#8290a7"
                    font.pixelSize: 13
                    Layout.alignment: Qt.AlignHCenter
                }
                Item { Layout.preferredHeight: 4 }
                SectionLabel { text: qsTr("ИМЯ ДЛЯ РЕГИСТРАЦИИ") }
                Field { id: displayNameField; Layout.fillWidth: true; placeholderText: qsTr("Как тебя показывать") }
                SectionLabel { text: qsTr("ЭЛЕКТРОННАЯ ПОЧТА") }
                Field { id: emailField; Layout.fillWidth: true; placeholderText: "name@example.com"; inputMethodHints: Qt.ImhEmailCharactersOnly }
                SectionLabel { text: qsTr("ПАРОЛЬ") }
                Field { id: passwordField; Layout.fillWidth: true; placeholderText: qsTr("Минимум 8 символов"); echoMode: TextInput.Password }
                PrimaryButton {
                    Layout.fillWidth: true
                    text: qsTr("Войти")
                    enabled: !backend.busy
                    onClicked: backend.signIn(emailField.text, passwordField.text)
                }
                Button {
                    Layout.fillWidth: true
                    implicitHeight: 44
                    text: qsTr("Создать аккаунт")
                    enabled: !backend.busy
                    onClicked: backend.signUp(emailField.text, passwordField.text, displayNameField.text)
                    contentItem: Text {
                        text: parent.text
                        color: "#aebfff"
                        font.pixelSize: 14
                        font.weight: Font.DemiBold
                        horizontalAlignment: Text.AlignHCenter
                        verticalAlignment: Text.AlignVCenter
                    }
                    background: Rectangle { color: "#1a2540"; radius: 12 }
                }
                Label {
                    Layout.fillWidth: true
                    text: backend.status
                    color: "#9eabc0"
                    wrapMode: Text.WordWrap
                    horizontalAlignment: Text.AlignHCenter
                    font.pixelSize: 12
                }
                Label {
                    Layout.fillWidth: true
                    text: qsTr("На Windows сессия хранится в системном хранилище учётных данных. На других платформах пока требуется повторный вход после закрытия приложения.")
                    color: "#65738a"
                    wrapMode: Text.WordWrap
                    horizontalAlignment: Text.AlignHCenter
                    font.pixelSize: 11
                }
            }
        }
    }

    RowLayout {
        anchors.fill: parent
        spacing: 0
        visible: backend.authenticated

        Rectangle {
            Layout.preferredWidth: 76
            Layout.fillHeight: true
            color: "#0d131e"
            ColumnLayout {
                anchors.fill: parent
                anchors.topMargin: 22
                anchors.bottomMargin: 18
                spacing: 18
                Label {
                    text: "D"
                    color: "#91a7ff"
                    font.pixelSize: 30
                    font.bold: true
                    Layout.alignment: Qt.AlignHCenter
                }
                Rectangle {
                    Layout.alignment: Qt.AlignHCenter
                    width: 44; height: 44; radius: 14
                    color: "#263654"
                    Label { anchors.centerIn: parent; text: "✉"; color: "#dce6ff"; font.pixelSize: 20 }
                }
                Item { Layout.fillHeight: true }
                Rectangle {
                    Layout.alignment: Qt.AlignHCenter
                    width: 42; height: 42; radius: 21
                    color: "#273248"
                    Label { anchors.centerIn: parent; text: "●"; color: "#a9bcff" }
                }
            }
        }

        ColumnLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0

            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 72
                color: "#111722"
                RowLayout {
                    anchors.fill: parent
                    anchors.leftMargin: 24
                    anchors.rightMargin: 22
                    Label {
                        text: qsTr("Dector")
                        color: "#f1f4fc"
                        font.pixelSize: 21
                        font.weight: Font.DemiBold
                    }
                    Item { Layout.fillWidth: true }
                    Label { text: backend.displayName; color: "#dce4f4"; font.pixelSize: 13 }
                    Button {
                        text: qsTr("Профиль")
                        onClicked: profileDialog.open()
                    }
                    Button {
                        text: qsTr("Выйти")
                        onClicked: backend.signOut()
                    }
                }
            }

            RowLayout {
                Layout.fillWidth: true
                Layout.fillHeight: true
                spacing: 0

                Rectangle {
                    Layout.preferredWidth: 320
                    Layout.fillHeight: true
                    color: "#0d131e"
                    ColumnLayout {
                        anchors.fill: parent
                        anchors.margins: 18
                        spacing: 14
                        Label { text: qsTr("Сообщения"); color: "#f2f5fd"; font.pixelSize: 20; font.weight: Font.DemiBold }
                        Field { id: searchUsername; Layout.fillWidth: true; placeholderText: qsTr("Username для нового чата") }
                        PrimaryButton {
                            Layout.fillWidth: true
                            text: qsTr("Начать личный чат")
                            enabled: !backend.busy
                            onClicked: backend.createDirectConversation(searchUsername.text)
                        }
                        RowLayout {
                            Layout.fillWidth: true
                            SectionLabel { text: qsTr("ТВОИ ЧАТЫ") }
                            Item { Layout.fillWidth: true }
                            ToolButton { text: "↻"; onClicked: backend.loadConversations() }
                        }
                        ListView {
                            id: chatList
                            Layout.fillWidth: true
                            Layout.fillHeight: true
                            clip: true
                            spacing: 7
                            model: backend.conversations
                            delegate: Rectangle {
                                required property var modelData
                                width: chatList.width
                                height: 68
                                radius: 13
                                color: window.selectedConversationId === modelData.id ? "#202d48" : "#121b29"
                                border.color: window.selectedConversationId === modelData.id ? "#536ca9" : "#1c293a"
                                RowLayout {
                                    anchors.fill: parent
                                    anchors.margins: 11
                                    Rectangle {
                                        width: 40; height: 40; radius: 14
                                        color: "#2b3d61"
                                        Label { anchors.centerIn: parent; text: "D"; color: "#dce6ff"; font.bold: true }
                                    }
                                    ColumnLayout {
                                        Layout.fillWidth: true
                                        spacing: 3
                                        Label {
                                            Layout.fillWidth: true
                                            text: modelData.title || modelData.peerName || (modelData.kind === "direct" ? qsTr("Личный чат") : qsTr("Группа"))
                                            color: "#eef2fb"
                                            font.pixelSize: 13
                                            elide: Text.ElideRight
                                        }
                                        Label { text: modelData.kind === "direct" ? qsTr("Личная переписка") : qsTr("Групповой чат"); color: "#8492a8"; font.pixelSize: 11 }
                                    }
                                }
                                MouseArea {
                                    anchors.fill: parent
                                    onClicked: {
                                        window.selectedConversationId = modelData.id
                                        window.selectedConversationTitle = modelData.title || modelData.peerName || qsTr("Личный чат")
                                        window.currentMessages = []
                                        backend.loadMessages(modelData.id)
                                    }
                                }
                            }
                            Label {
                                anchors.centerIn: parent
                                visible: chatList.count === 0
                                text: qsTr("Пока нет чатов")
                                color: "#748198"
                                font.pixelSize: 13
                            }
                        }
                    }
                }

                Rectangle {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    color: "#0a0f18"
                    ColumnLayout {
                        anchors.fill: parent
                        spacing: 0
                        Rectangle {
                            Layout.fillWidth: true
                            Layout.preferredHeight: 68
                            color: "#111722"
                            RowLayout {
                                anchors.fill: parent
                                anchors.leftMargin: 22
                                anchors.rightMargin: 22
                                Label { text: window.selectedConversationTitle; color: "#f1f4fc"; font.pixelSize: 17; font.weight: Font.DemiBold }
                                Item { Layout.fillWidth: true }
                                ToolButton { text: "↻"; enabled: window.selectedConversationId !== ""; onClicked: backend.loadMessages(window.selectedConversationId) }
                            }
                        }
                        ListView {
                            id: messageList
                            Layout.fillWidth: true
                            Layout.fillHeight: true
                            clip: true
                            model: window.currentMessages
                            delegate: Rectangle {
                                required property var modelData
                                width: Math.min(messageList.width - 48, 520)
                                height: 76
                                radius: 14
                                color: "#151f2e"
                                border.color: "#26334a"
                                RowLayout {
                                    anchors.fill: parent
                                    anchors.margins: 14
                                    ColumnLayout {
                                        Layout.fillWidth: true
                                        Label { text: qsTr("Зашифрованное сообщение"); color: "#e2e9f8"; font.pixelSize: 13 }
                                        Label { text: modelData.createdAt; color: "#7d8ba2"; font.pixelSize: 10 }
                                    }
                                    Label { text: "🔒"; font.pixelSize: 16 }
                                }
                            }
                            Label {
                                anchors.centerIn: parent
                                visible: messageList.count === 0 && window.selectedConversationId !== ""
                                text: qsTr("В этом чате пока нет сообщений")
                                color: "#7c8aa1"
                            }
                            Label {
                                anchors.centerIn: parent
                                visible: window.selectedConversationId === ""
                                text: qsTr("Выбери чат слева или начни новый")
                                color: "#7c8aa1"
                            }
                        }
                        Rectangle {
                            Layout.fillWidth: true
                            Layout.preferredHeight: 68
                            color: "#111722"
                            Label {
                                anchors.centerIn: parent
                                text: qsTr("Отправка сообщений включится после подключения проверенного E2EE-шифрования")
                                color: "#8796ad"
                                font.pixelSize: 12
                                wrapMode: Text.WordWrap
                            }
                        }
                    }
                }
            }
        }
    }

    Dialog {
        id: profileDialog
        modal: true
        anchors.centerIn: parent
        width: 440
        title: qsTr("Профиль")
        standardButtons: Dialog.NoButton
        background: Surface {}
        ColumnLayout {
            anchors.fill: parent
            spacing: 12
            SectionLabel { text: qsTr("ОТОБРАЖАЕМОЕ ИМЯ") }
            Field { id: profileName; Layout.fillWidth: true; text: backend.displayName }
            SectionLabel { text: qsTr("USERNAME") }
            Field { id: profileUsername; Layout.fillWidth: true; text: backend.username }
            SectionLabel { text: qsTr("О СЕБЕ") }
            TextArea {
                id: profileBio
                Layout.fillWidth: true
                Layout.preferredHeight: 90
                color: "#edf2ff"
                placeholderText: qsTr("Расскажи немного о себе")
                text: backend.bio
                background: Rectangle { color: "#0c121d"; radius: 12; border.color: "#293449" }
            }
            PrimaryButton {
                Layout.fillWidth: true
                text: qsTr("Сохранить профиль")
                onClicked: {
                    backend.updateProfile(profileName.text, profileUsername.text, profileBio.text)
                    profileDialog.close()
                }
            }
            Label { Layout.fillWidth: true; text: backend.status; color: "#8998ae"; wrapMode: Text.WordWrap; font.pixelSize: 11 }
        }
        onOpened: backend.refreshProfile()
    }
}
