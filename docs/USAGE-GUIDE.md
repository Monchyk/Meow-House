# Deep House usage guide

Start at `http://127.0.0.1:8800/`. That page is a map of every experience. Click a card to open it, and use your browser's Back button to return.

Some pages flash, pulse, or move quickly. Stop or close the page if that is uncomfortable.

## The House

Open `http://127.0.0.1:8800/house.html`.

Press any ordinary key to leave the opening screen. The arrow keys look around the constellation. Press Enter to travel to another star or examine the star you are standing on. Press Escape to step back.

When an instrument is open:

- Up and Down change the highlighted choice.
- Enter opens or confirms the choice.
- Escape returns to the previous view.
- H stirs the colour and movement. The effect is partly unpredictable on purpose.
- Space taps a tempo when the deck instrument is open.

The number keys also work: 1 is Up, 2 is Down, 3 is Enter, 4 is Back, and 5 is H.

There is no score and no wrong path. Moving, waiting, and repeating a choice all change the organism a little.

## Party

Open `http://127.0.0.1:8800/party.html`, then press F11 for full screen.

- Hold Up to make the visual busier and brighter.
- Hold Down to make it quieter and darker.
- Press P to change the steering mode.
- Press lowercase h to preview or cycle the next visual.
- Hold Shift and press H to commit the preview.
- Press D to show or hide the small status display.

Let go of Up or Down when the energy feels right. Slow changes usually look better than frantic tapping.

## Organisms and visual labs

Most lab pages explain their controls on the screen. Sliders change the drawing immediately. Clicking, dragging, or moving the pointer often changes a shape. If a page has an **auto** or **sweep** option, turn it on and simply watch.

Useful places to begin:

- **Organisms** is the broad visual gallery.
- **Spirals** and **Spiral Mash** focus on rotating mathematical forms.
- **Blend Lab** combines layers.
- **Helix Tuner** exposes detailed controls.
- **Experiments** responds to dragging; Space snaps its tiles toward order.
- **Colour Field** is good when you want something ambient rather than game-like.

## Arcade and games

Open **The Arcade**, choose a game, and follow the words shown on that page.

Across most games:

- Up or W moves up.
- Down or S moves down.
- Enter or Space selects.
- Backspace or Left Arrow undoes or goes back.
- Escape leaves the current game.

Some games are meant for a shared room screen plus phones. They are still safe to open alone, but may wait for another player or display.

## Second display

Open The House in one browser window and `display.html` in another. The second display follows the first automatically. Move it to a television or projector and press F11.

If it keeps saying that it is waiting, make sure `house.html` is open in the same browser on the same computer. Refresh both pages once.

## Phone or another computer

Deep House runs on the main computer. A phone or other device is optional and works alongside that main screen. Both devices must use the same Wi-Fi.

On Windows, open Command Prompt, type `ipconfig`, and press Enter. Find **IPv4 Address** in the Wi-Fi section. On the main computer, open `http://YOUR-IP:8800/qr/`, replacing `YOUR-IP` with that number.

In Chrome or Edge, right-click an empty part of the QR launcher and choose **Create QR code for this page**. Scan the code with the phone's Camera app. The launcher opens on the phone, where you can choose an available control or display page.

Do not use `127.0.0.1` or `localhost` on the phone: those names point back to the phone itself, not the computer.

## Dashboard and Basement

These are operator tools:

- **Party Dashboard** shows and changes live party state.
- **The Basement** offers a compact phone-sized set of performance controls.
You do not need any of them for ordinary screen-only use. Changes made in an operator tool can affect other open Deep House pages, so refresh the pages if you want a clean start.

Cards marked **Not in public version** are intentionally visible but disabled. They show that the private installation contains more experiments without making those pages part of the public menu.

## Smart lights

Hue lights are optional. A red or offline light indicator only means the separate Hue controller is absent; it does not mean Deep House is broken. The browser art, controls, and games continue normally.

Never paste a real Hue key into a file you plan to share. If an advanced user creates `controller/config.json`, keep that file on the local computer only.

## Ending a session

Close the browser windows. Then return to the terminal that is running Deep House, hold Ctrl, and tap C. When the terminal stops printing, close it.
