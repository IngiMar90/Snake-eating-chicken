const CACHE = "snake-chicken-v3";
const CORE = [
  "./", "./index.html", "./styles.css", "./game.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png",
  "./assets/sprites/cover.webp", "./assets/sprites/grass.webp", "./assets/sprites/rock.webp", "./assets/sprites/snow.webp",
  "./assets/sprites/chicken.webp", "./assets/sprites/hen.webp", "./assets/sprites/rooster.webp", "./assets/sprites/golden_chicken.webp", "./assets/sprites/boss_rooster.webp",
  "./assets/sprites/obstacle_rock.webp", "./assets/sprites/obstacle_fence.webp", "./assets/sprites/hud_heart.webp",
  "./assets/sprites/snake_head.webp", "./assets/sprites/snake_head_eating.webp", "./assets/sprites/snake_body.webp", "./assets/sprites/snake_tail.webp",
  "./assets/sprites/snake_head_yellow.webp", "./assets/sprites/snake_head_yellow_eating.webp", "./assets/sprites/snake_body_yellow.webp", "./assets/sprites/snake_tail_yellow.webp",
  "./assets/sprites/snake_head_blue.webp", "./assets/sprites/snake_head_blue_eating.webp", "./assets/sprites/snake_body_blue.webp", "./assets/sprites/snake_tail_blue_v2.webp",
  "./assets/sprites/powerup_shield.webp", "./assets/sprites/powerup_magnet.webp", "./assets/sprites/powerup_slow.webp", "./assets/sprites/powerup_double_points.webp", "./assets/sprites/powerup_ghost.webp", "./assets/sprites/powerup_shorten.webp",
  "./assets/audio/eat_chicken.ogg", "./assets/audio/chicken_cluck.ogg", "./assets/audio/golden_chicken.ogg", "./assets/audio/powerup.ogg", "./assets/audio/combo.ogg",
  "./assets/audio/shield_hit.ogg", "./assets/audio/collision_soft.ogg", "./assets/audio/rock_hit.ogg", "./assets/audio/fence_hit.ogg",
  "./assets/audio/level_complete.ogg", "./assets/audio/game_win.ogg", "./assets/audio/game_over.ogg", "./assets/audio/boss_rooster.ogg",
  "./assets/audio/ui_click.ogg", "./assets/audio/ui_back.ogg", "./assets/audio/shop_buy.ogg"
];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match("./index.html"))));
});
