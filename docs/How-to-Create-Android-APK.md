# How to create Tandil Android APK (Expo / EAS) — Step by step

Follow these steps in order on your Mac Terminal.

---

## Step 0 — Open project folder

```bash
cd /Users/sanjeevkumar/Desktop/Aakash/tandil
```

---

## Step 1 — Install / update EAS CLI (one time)

```bash
npm install -g eas-cli
```

Check version:

```bash
eas --version
```

---

## Step 2 — Login to Expo account

```bash
eas login
```

- Enter your Expo email / username and password  
- Or use the browser login if prompted  

Confirm you are logged in:

```bash
eas whoami
```

You should see your Expo username.

---

## Step 3 — Confirm Android package (already set)

In `app.json` Android package is:

```text
com.tandilapp.tandil
```

This matches the iOS bundle id style and is required for APK builds.

---

## Step 4 — Start APK build (cloud)

Use the **preview** profile (standalone APK for client testing):

```bash
eas build -p android --profile preview
```

> Important: `preview` / `production` must **not** use `assembleDebug`.
> Debug APKs fail on device with: *Unable to load script / index.android.bundle*
> (they expect Metro). The fixed config builds a **release APK** with the JS bundle inside.

### What Expo may ask

1. **Generate a new Android Keystore?**  
   - First time: type **`Y`** (Yes) — EAS will create and store it  
   - Later builds: usually reuse the existing one  

2. Wait for the cloud build (often **10–20 minutes**)

Keep the terminal open. You will get a build URL like:

```text
https://expo.dev/accounts/.../projects/tandil/builds/...
```

---

## Step 5 — Download the APK

When status is **Finished**:

**Option A — Terminal link**  
Open the build URL from the terminal output.

**Option B — Expo website**  
1. Go to [https://expo.dev](https://expo.dev)  
2. Open project **tandil**  
3. Click **Builds**  
4. Open the latest Android build  
5. Click **Download** → save the `.apk` file  

---

## Step 6 — Install on Android phone

1. Send the APK to the phone (WhatsApp / Drive / email / cable)  
2. On phone: open the file  
3. If asked, allow **Install unknown apps** for that app (Files / Chrome / Drive)  
4. Tap **Install** → open **Tandil**

---

## Useful commands

| Action | Command |
|--------|---------|
| Build test APK | `eas build -p android --profile preview` |
| See recent builds | `eas build:list -p android` |
| Who am I logged in as | `eas whoami` |
| Logout | `eas logout` |

---

## Notes

- **Preview APK** = best for sharing with client for testing  
- **Play Store** later usually needs an **AAB** (`app-bundle`), not only APK  
- First build is slower; next builds are often faster  
- Need internet + Expo account (free tier works for this)

---

## If something fails

| Problem | Fix |
|---------|-----|
| `eas: command not found` | Run Step 1 again |
| Not logged in / Forbidden | Run `eas logout` then `eas login` |
| Missing package / applicationId | Confirm `android.package` in `app.json` |
| Build failed | Open the build page → **Logs** → share the error |

---

*Project: Tandil · Profile: `preview` · Output: `.apk`*
