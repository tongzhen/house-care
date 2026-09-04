#!/bin/sh
set -eu

if [ -z "${JAVA_HOME:-}" ]; then
  android_studio_jdk="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
  homebrew_jdk="/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home"
  if [ -d "$android_studio_jdk" ]; then
    JAVA_HOME="$android_studio_jdk"
  elif [ -d "$homebrew_jdk" ]; then
    JAVA_HOME="$homebrew_jdk"
  else
    echo "Maestro requires Java 17 or newer. Set JAVA_HOME before running this script." >&2
    exit 1
  fi
  export JAVA_HOME
fi

export MAESTRO_CLI_NO_ANALYTICS=1
export MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED=true

exec maestro "$@"
