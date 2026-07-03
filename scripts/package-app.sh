#!/bin/bash
# DeskGhost.app 패키징 — node_modules/electron의 Electron.app을 복제해 앱 번들 구성
# 사용법: bash scripts/package-app.sh [설치경로(기본 /Applications)]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="${1:-/Applications}"
BUILD="$ROOT/dist"
APP="$BUILD/DeskGhost.app"

rm -rf "$BUILD" && mkdir -p "$BUILD"
cp -R "$ROOT/node_modules/electron/dist/Electron.app" "$APP"

# 앱 코드 → Contents/Resources/app (default_app 제거)
RES="$APP/Contents/Resources"
rm -f "$RES/default_app.asar"
mkdir -p "$RES/app"
cp "$ROOT/package.json" "$ROOT/main.js" "$ROOT/preload.js" "$RES/app/"
cp -R "$ROOT/src" "$ROOT/renderer" "$ROOT/assets" "$RES/app/"
[ -f "$ROOT/.env" ] && cp "$ROOT/.env" "$RES/app/"

# 프로덕션 의존성만 복사 (electron 제외)
cp -R "$ROOT/node_modules" "$RES/app/node_modules"
rm -rf "$RES/app/node_modules/electron" "$RES/app/node_modules/.bin"

# 아이콘 교체
rm -f "$RES/electron.icns"
cp "$ROOT/assets/icon.icns" "$RES/icon.icns"

# Info.plist: 이름/번들ID/아이콘/실행파일, 메뉴바 전용(LSUIElement)
PLIST="$APP/Contents/Info.plist"
mv "$APP/Contents/MacOS/Electron" "$APP/Contents/MacOS/DeskGhost"
/usr/libexec/PlistBuddy -c "Set :CFBundleExecutable DeskGhost" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleName DeskGhost" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string DeskGhost" "$PLIST" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName DeskGhost" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.gridnflow.deskghost" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleIconFile icon.icns" "$PLIST"
/usr/libexec/PlistBuddy -c "Add :LSUIElement bool true" "$PLIST" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Set :LSUIElement true" "$PLIST"

# 수정된 번들 ad-hoc 재서명 (미서명 바이너리는 실행 불가)
codesign --force --deep --sign - "$APP" >/dev/null 2>&1

# 설치
rm -rf "$DEST_DIR/DeskGhost.app"
ditto "$APP" "$DEST_DIR/DeskGhost.app"
echo "설치 완료: $DEST_DIR/DeskGhost.app"
