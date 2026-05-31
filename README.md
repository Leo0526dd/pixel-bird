# Pixel Bird

Pixel Bird is a small retro flying game built with Next.js. Click, tap, or press Space to fly through pipes and chase a high score.

## Features

- Pixel platform-game style
- Bird species and color skins
- Click, touch, Space, Enter, and Arrow Up controls
- Esc to pause or resume
- Flap, score, milestone, record, crash, NPC, rain, and wind sounds
- Gold milestone pipes every 10 points
- Dynamic weather: sunny, cloudy, rain, snow, and wind
- Small mechanisms and cheering animal NPCs
- Browser-local high score

## Local Play

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Same Wi-Fi Play

Start LAN mode:

```bash
npm run dev:lan
```

Devices on the same Wi-Fi can open:

```text
http://YOUR_LAN_IP:3000
```

Example:

```text
http://192.168.1.218:3000
```

If it does not open, allow Node.js or port 3000 through your firewall.

## Public Internet Play

To let players on different networks play, deploy the app to a public host.

Recommended options:

- GitHub Pages with the included workflow
- Vercel for the simplest public HTTPS deployment
- Docker on a VPS
- Cloudflare Tunnel for a temporary public URL from your local machine

See [DEPLOY.md](./DEPLOY.md) for deployment steps.

## Offline Play

Pixel Bird is a PWA. After a device successfully opens the game once, the browser caches the app for offline play.

Recommended flow:

1. Open the public game URL once while online.
2. Use the browser menu to choose `Install app` or `Add to Home screen`.
3. Open the installed app later, even with weak network or no network.

The first visit still needs access to the hosting URL. If a network cannot reach GitHub Pages at all, share the game through another reachable host or an offline package.

## Production

```bash
npm run build
npm run start
```

## License

MIT License. See [LICENSE](./LICENSE).
