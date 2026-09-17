# Deep House

Deep House is a collection of interactive art: moving mathematical drawings, colour, small games, and optional smart-light effects. You do not need smart lights, a projector, or any programming knowledge. A normal computer and web browser are enough.

## Start it on Windows

Do these steps once:

1. Go to [python.org/downloads](https://www.python.org/downloads/).
2. Click the large **Download Python 3** button.
3. Open the downloaded installer.
4. On the first installer screen, tick **Add python.exe to PATH**.
5. Click **Install Now**. Wait for it to finish, then close it.

Do these steps whenever you want to use Deep House:

1. Open the **Meow House** folder in File Explorer.
2. Right-click an empty spot inside the folder.
3. Click **Open in Terminal**. A dark window will appear.
4. Type exactly this, then press Enter:

   ```text
   python controller/serve.py
   ```

5. If Windows says `python` is not found, type this instead and press Enter:

   ```text
   py controller/serve.py
   ```

6. Leave the dark window open. It is the small local server that lets the pages talk to each other.
7. Open Chrome, Edge, Firefox, or Safari.
8. Click the address bar, type this, and press Enter:

   ```text
   http://127.0.0.1:8800/
   ```

9. Choose any page. **The House** is the best first one.

To stop, return to the dark terminal window, hold Ctrl, and tap C. You may then close the window.

## Start it on macOS

1. Install Python 3 from [python.org/downloads](https://www.python.org/downloads/) if it is not already installed.
2. Open the **Terminal** app.
3. Type `cd `, including the space after `cd`.
4. Drag the **Meow House** folder into the Terminal window and press Return.
5. Type `python3 controller/serve.py` and press Return.
6. Open `http://127.0.0.1:8800/` in your browser.
7. To stop, return to Terminal, hold Control, and tap C.

## What to open

- `http://127.0.0.1:8800/` is the friendly list of every page.
- `http://127.0.0.1:8800/house.html` is the main Deep House experience.
- `http://127.0.0.1:8800/party.html` is the full-screen party visual.
- `http://127.0.0.1:8800/display.html` is a second-screen view that follows The House.

Do not double-click the HTML files. Start the server and use the address above; several pages need the server to share their state.

The grey cards marked **Not in public version** show work that exists in the private installation but is intentionally unavailable here. They cannot be clicked.

## Using it

The short version: click a page and experiment. Nothing here can damage your computer. Press F11 for full screen and F11 again to leave full screen.

The main controls and plain-English tips are in [docs/USAGE-GUIDE.md](docs/USAGE-GUIDE.md).

## Optional: use another window on the same computer

1. Start Deep House normally.
2. Open `http://127.0.0.1:8800/house.html` in one browser window.
3. Open `http://127.0.0.1:8800/display.html` in another browser window.
4. Drag the second window to a television, projector, or second monitor.
5. Press F11 in that window for full screen.

The display waits until The House is open. Both pages must be in the same browser on the same computer.

## Optional: use a phone or another device

The main experience still runs in the browser on the computer that started Deep House. A phone, tablet, television, or second computer is an optional extra for controlling or watching alongside it.

The computer and second device must be connected to the same Wi-Fi.

First, find the computer's IP address on Windows:

1. Click the Start button.
2. Type `Command Prompt`.
3. Click **Command Prompt**.
4. Type `ipconfig` and press Enter.
5. Look for **IPv4 Address** under the Wi-Fi section. It will look similar to `192.168.1.23`.
6. Keep that window open or write the number down.

Next, open the QR launcher on the computer:

1. Replace `YOUR-IP` in the address below with the IPv4 Address you just found:

   ```text
   http://YOUR-IP:8800/qr/
   ```

2. For example, if the IPv4 Address is `192.168.1.23`, open `http://192.168.1.23:8800/qr/`.
3. Right-click an empty part of the QR launcher page in Chrome or Edge.
4. Click **Create QR code for this page**.
5. Open the Camera app on the phone and point it at the QR code.
6. Tap the message that appears. The launcher will open on the phone.
7. Tap the screen or controller you want to open.

If the browser has no **Create QR code for this page** option, type the full `http://YOUR-IP:8800/qr/` address directly into the phone's browser.

## Optional bonus: Philips Hue lights

The screen experience works without Hue. The Hue controller is a separate advanced project and is not included in this public copy. If you already have the matching controller running on port 5000, Deep House will find it through the local server. If you do not, the page may say **lights offline**; that is normal and everything on screen keeps working.

`controller/config.example.json` contains safe placeholders for advanced users. Never share a real Hue application key or a filled-in `controller/config.json`.

## If something goes wrong

- **The browser says it cannot connect:** check that the terminal is still open and shows `catalogue http://127.0.0.1:8800/`.
- **The phone cannot connect:** check that both devices use the same Wi-Fi and that the phone address contains the computer's IPv4 Address, not `127.0.0.1` or `localhost`.
- **The terminal says Python is not found:** close the terminal, install Python using the steps above, then open a new terminal and try again.
- **The page is blank or old:** press Ctrl+R on Windows or Command+R on macOS.
- **The lights say offline:** ignore this unless you deliberately set up the separate Hue controller.
- **Port 8800 is already in use:** another Deep House terminal may already be running. Find it and press Ctrl+C, then try again.

## Privacy

This is a clean public copy with no private source corpus, personal story archive, local Hue credentials, or original Git history. Keep `controller/config.json` private if you create one.
