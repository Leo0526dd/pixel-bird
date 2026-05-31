# Public Deployment

This game builds as a static site, so it can run on GitHub Pages or any static web host.

## Option 1: GitHub Pages

This repository includes `.github/workflows/pages.yml`.

1. Push the repository to GitHub.
2. Open the repository on GitHub.
3. Go to `Settings` -> `Pages`.
4. Under `Build and deployment`, set `Source` to `GitHub Actions`.
5. Push to `main` or run the `Deploy to GitHub Pages` workflow manually.

The public URL will look like:

```text
https://YOUR_USERNAME.github.io/pixel-bird/
```

## Option 2: Vercel

1. Push this project to a GitHub repository.
2. Import the repository in Vercel.
3. Keep the default Next.js settings.
4. Deploy.

After deployment, Vercel gives you a public HTTPS URL that works from any network.

## Option 3: Docker

Build the image:

```bash
docker build -t pixel-bird .
```

Run it:

```bash
docker run --rm -p 3000:3000 pixel-bird
```

Open:

```text
http://localhost:3000
```

On a public server, point a domain or reverse proxy to port 3000.

## Option 4: Cloudflare Tunnel

Cloudflare Tunnel can expose a local run without opening router ports.

1. Install `cloudflared`.
2. Run the app locally:

```bash
npm run start:lan
```

3. Create a tunnel to local port 3000:

```bash
cloudflared tunnel --url http://localhost:3000
```

Cloudflare will provide a temporary public URL.

## Notes

- Public hosting should use HTTPS.
- The game has no server-side player data; high scores are stored in each browser.
- If you use a VPS, place Nginx, Caddy, or another reverse proxy in front of the app.
