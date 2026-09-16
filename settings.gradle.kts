import java.io.File

pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        // Xposed API (provided by the framework at runtime).
        maven(url = "https://api.xposed.info/")
        // Populated by scripts/prepare-revenge-api.* or the CI setup steps.
        mavenLocal()
    }
}

rootProject.name = "selective-media-saver-revenge"

file("plugins").listFiles()
    ?.filter { it.isDirectory && File(it, "src/main").isDirectory }
    ?.sortedBy { it.name }
    ?.forEach { dir -> include(":plugins:${dir.name}") }
