import QtQuick
import QtQuick.Controls
import QtQuick.Layouts

ApplicationWindow {
    id: window
    width: 1180
    height: 760
    minimumWidth: 900
    minimumHeight: 600
    visible: true
    title: qsTr("Dector")
    color: "#0b0d12"

    RowLayout {
        anchors.fill: parent
        spacing: 0

        Rectangle {
            Layout.preferredWidth: 76
            Layout.fillHeight: true
            color: "#10141d"

            ColumnLayout {
                anchors.fill: parent
                anchors.topMargin: 22
                spacing: 18
                Label {
                    text: "D"
                    color: "#8ca8ff"
                    font.pixelSize: 30
                    font.bold: true
                    Layout.alignment: Qt.AlignHCenter
                }
                Rectangle {
                    Layout.alignment: Qt.AlignHCenter
                    width: 42
                    height: 42
                    radius: 14
                    color: "#202b42"
                    Label { anchors.centerIn: parent; text: "✉"; color: "#dce6ff"; font.pixelSize: 19 }
                }
                Item { Layout.fillHeight: true }
                Rectangle {
                    Layout.alignment: Qt.AlignHCenter
                    width: 42
                    height: 42
                    radius: 21
                    color: "#263247"
                    Label { anchors.centerIn: parent; text: "●"; color: "#9fb8ff" }
                    Layout.bottomMargin: 18
                }
            }
        }

        ColumnLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            spacing: 0

            Rectangle {
                Layout.fillWidth: true
                Layout.preferredHeight: 68
                color: "#111722"
                Label {
                    anchors.left: parent.left
                    anchors.leftMargin: 26
                    anchors.verticalCenter: parent.verticalCenter
                    text: qsTr("Dector")
                    color: "#f2f5fb"
                    font.pixelSize: 21
                    font.weight: Font.DemiBold
                }
            }

            Item {
                Layout.fillWidth: true
                Layout.fillHeight: true
                Column {
                    anchors.centerIn: parent
                    spacing: 10
                    Label {
                        anchors.horizontalCenter: parent.horizontalCenter
                        text: qsTr("Dector")
                        color: "#f3f6fc"
                        font.pixelSize: 30
                        font.weight: Font.DemiBold
                    }
                    Label {
                        anchors.horizontalCenter: parent.horizontalCenter
                        text: qsTr("Native messenger foundation")
                        color: "#8f9bad"
                        font.pixelSize: 14
                    }
                }
            }
        }
    }
}
