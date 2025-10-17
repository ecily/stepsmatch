# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt

# ─────────────────────────────────────────────────────────────
# React Native / Reanimated / TurboModules
# ─────────────────────────────────────────────────────────────
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Hermes Intl (safe)
-keep class com.facebook.hermes.intl.** { *; }

# ─────────────────────────────────────────────────────────────
# Expo / Notifications / Location / TaskManager / WorkManager
# ─────────────────────────────────────────────────────────────
-keep class expo.modules.notifications.** { *; }
-keep class expo.modules.location.** { *; }
-keep class expo.modules.taskManager.** { *; }
-keep class androidx.work.** { *; }                  # WorkManager jobs & constraints

# GMS / Firebase types (used under the hood by expo-notifications)
-keep class com.google.android.gms.** { *; }
-keep class com.google.firebase.** { *; }
-dontwarn com.google.android.gms.**
-dontwarn com.google.firebase.**

# OkHttp/Okio (reflection-friendly)
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# Kotlin metadata
-keep class kotlin.Metadata { *; }

# ─────────────────────────────────────────────────────────────
# Keep ContentProviders/Services defined via manifest merging
# (defensive: avoid stripping if referenced reflectively)
# ─────────────────────────────────────────────────────────────
-keep class androidx.startup.InitializationProvider { *; }

# Add any project specific keep options here:
