# Forge Time Tracker extension

This extension sends the active browser page and an optional note to Forge’s Time Tracker. The timer and saved data remain inside your authenticated Forge account.

## Install locally

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `chrome-extension` folder.
5. Pin **Forge Time Tracker** from Chrome’s extensions menu.

## Pair the shared timer

1. In Forge, open **Time tracker** and expand **Connect the Chrome extension to this shared timer**.
2. Generate a pairing code and copy it.
3. Open the extension, paste the code, then choose **Connect / refresh timer**.

The extension now shows and can stop the same active timer as Forge. Its pairing code is stored in Chrome sync storage; Forge stores only a secure one-way hash of the code.
