cmake_minimum_required(VERSION 3.24)
project(Dector VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(Qt6 6.5 REQUIRED COMPONENTS Quick Network)
qt_standard_project_setup(REQUIRES 6.5)

qt_add_executable(dector-desktop
    apps/desktop/main.cpp
    apps/desktop/BackendClient.cpp
    apps/desktop/BackendClient.h
)

qt_add_qml_module(dector-desktop
    URI Dector
    VERSION 1.0
    QML_FILES
        apps/desktop/qml/Main.qml
)

target_link_libraries(dector-desktop PRIVATE
    Qt6::Quick
    Qt6::Network
)

target_compile_definitions(dector-desktop PRIVATE
    DECTOR_VERSION="${PROJECT_VERSION}"
)

set_target_properties(dector-desktop PROPERTIES
    MACOSX_BUNDLE TRUE
    WIN32_EXECUTABLE TRUE
)

install(TARGETS dector-desktop
    RUNTIME DESTINATION .
    BUNDLE DESTINATION .
)
