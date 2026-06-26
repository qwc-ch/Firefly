<script lang="ts">
import { DARK_MODE, LIGHT_MODE } from "@/constants/constants";
import { getIconSvg } from "@/constants/icons";
import { clearAuth, isAuthenticated } from "@/lib/api";
import { getStoredTheme, setTheme } from "@/utils/setting-utils";
import ConfigEditor from "./ConfigEditor.svelte";
import ImageManager from "./ImageManager.svelte";
import LoginForm from "./LoginForm.svelte";
import PostEditor from "./PostEditor.svelte";
import PostList from "./PostList.svelte";

const DESKTOP = [
	"/assets/wallpaper/desktop/d1.avif",
	"/assets/wallpaper/desktop/d2.avif",
	"/assets/wallpaper/desktop/d3.avif",
	"/assets/wallpaper/desktop/d4.avif",
	"/assets/wallpaper/desktop/d5.avif",
	"/assets/wallpaper/desktop/d6.avif",
];
const MOBILE = [
	"/assets/wallpaper/mobile/m1.avif",
	"/assets/wallpaper/mobile/m2.avif",
	"/assets/wallpaper/mobile/m3.avif",
	"/assets/wallpaper/mobile/m4.avif",
	"/assets/wallpaper/mobile/m5.avif",
	"/assets/wallpaper/mobile/m6.avif",
];

let currentView = $state<"list" | "editor" | "images" | "config">("list");
let editingSlug = $state<string | null>(null);
let loggedIn = $state(isAuthenticated());
let menuOpen = $state(false);
let scrolled = $state(false);
let hidden = $state(false);
let lastScrollY = 0;
let currentSlide = $state(0);
let isMobile = $state(false);
let isDark = $state(false);

let images = $derived(isMobile ? MOBILE : DESKTOP);

function updateScroll() {
	const y = window.scrollY;
	scrolled = y > 50;
	hidden = y > lastScrollY && y > 200;
	lastScrollY = y;
}
function updateIsMobile() {
	isMobile = window.innerWidth <= 767;
}
function updateTheme() {
	isDark = document.documentElement.classList.contains("dark");
}
function toggleTheme() {
	setTheme(isDark ? LIGHT_MODE : DARK_MODE);
	updateTheme();
}

$effect(() => {
	updateIsMobile();
	updateScroll();
	updateTheme();
	window.addEventListener("scroll", updateScroll, { passive: true });
	window.addEventListener("resize", updateIsMobile);
	window.addEventListener("theme-change", updateTheme);
	return () => {
		window.removeEventListener("scroll", updateScroll);
		window.removeEventListener("resize", updateIsMobile);
		window.removeEventListener("theme-change", updateTheme);
	};
});

$effect(() => {
	const id = setInterval(() => {
		currentSlide = (currentSlide + 1) % images.length;
	}, 5000);
	return () => clearInterval(id);
});

function handleLogin() {
	loggedIn = true;
}
function handleLogout() {
	clearAuth();
	loggedIn = false;
}
function navigate(
	view: "list" | "editor" | "images" | "config",
	slug?: string,
) {
	currentView = view;
	editingSlug = slug ?? null;
	menuOpen = false;
	window.scrollTo(0, 0);
}
</script>

{#if !loggedIn}
  <LoginForm onLogin={handleLogin} />
{:else}
  <div class="wallpaper-fixed">
    {#each images as img, i (img)}
      <div class="wp-slide" class:active={currentSlide === i}>
        <img src={img} alt="" />
      </div>
    {/each}
    <div class="wp-dim"></div>
  </div>

  <div class="admin-layout">
    <!-- Desktop navbar -->
    <header class="navbar" class:scrolled class:hidden>
      <div class="navbar-inner">
        <a href="/" class="navbar-brand">
          <img src="/assets/images/firefly.png" alt="" class="navbar-logo" />
          <span class="navbar-title">Firefly Admin</span>
        </a>
        <nav class="navbar-nav">
          <button class="nav-btn" class:active={currentView === 'list'} onclick={() => navigate('list')}>文章管理</button>
          <button class="nav-btn" class:active={currentView === 'editor' && !editingSlug} onclick={() => navigate('editor')}>写文章</button>
          <button class="nav-btn" class:active={currentView === 'images'} onclick={() => navigate('images')}>图片管理</button>
          <button class="nav-btn" class:active={currentView === 'config'} onclick={() => navigate('config')}>站点配置</button>
        </nav>
        <div class="navbar-right">
          <button class="nav-icon" onclick={toggleTheme} title={isDark ? "切换亮色" : "切换暗色"}>
            {#if isDark}
              <i class="icon" style="font-size:18px">{@html getIconSvg("material-symbols:wb-sunny-outline-rounded")}</i>
            {:else}
              <i class="icon" style="font-size:18px">{@html getIconSvg("material-symbols:dark-mode-outline-rounded")}</i>
            {/if}
          </button>
          <a href="/" class="nav-icon" title="返回首页">
            <i class="icon" style="font-size:18px">{@html getIconSvg("material-symbols:home")}</i>
          </a>
          <button class="nav-icon" onclick={handleLogout} title="退出">
            <i class="icon" style="font-size:18px">{@html getIconSvg("material-symbols:logout")}</i>
          </button>
          <button class="hamburger" onclick={() => menuOpen = !menuOpen}>
            <i class="icon" style="font-size:22px">{@html getIconSvg("material-symbols:menu")}</i>
          </button>
        </div>
      </div>
    </header>

    <!-- Mobile: brand left + hamburger right -->
    <div class="mobile-topbar" class:scrolled class:hidden>
      <a href="/" class="mobile-brand">
        <img src="/assets/images/firefly.png" alt="" class="mobile-logo" />
        <span class="mobile-brand-text">Firefly Admin</span>
      </a>
      <div class="mobile-topbar-right">
        <button class="mobile-theme-btn" onclick={toggleTheme}>
          {#if isDark}
            <i class="icon" style="font-size:18px">{@html getIconSvg("material-symbols:wb-sunny-outline-rounded")}</i>
          {:else}
            <i class="icon" style="font-size:18px">{@html getIconSvg("material-symbols:dark-mode-outline-rounded")}</i>
          {/if}
        </button>
        <button class="mobile-hamburger" onclick={() => menuOpen = !menuOpen}>
          <i class="icon" style="font-size:22px">{@html getIconSvg("material-symbols:menu")}</i>
        </button>
      </div>
    </div>

    {#if menuOpen}
      <button class="menu-overlay" onclick={() => menuOpen = false}></button>
      <div class="popup-menu">
        <button class="popup-item" class:active={currentView === 'list'} onclick={() => navigate('list')}>
          <i class="icon" style="font-size:18px">{@html getIconSvg("material-symbols:article")}</i>
          <span>文章管理</span>
        </button>
        <button class="popup-item" class:active={currentView === 'editor' && !editingSlug} onclick={() => navigate('editor')}>
          <i class="icon" style="font-size:18px">{@html getIconSvg("material-symbols:edit")}</i>
          <span>写文章</span>
        </button>
        <button class="popup-item" class:active={currentView === 'images'} onclick={() => navigate('images')}>
          <i class="icon" style="font-size:18px">{@html getIconSvg("material-symbols:image")}</i>
          <span>图片管理</span>
        </button>
        <button class="popup-item" class:active={currentView === 'config'} onclick={() => navigate('config')}>
          <i class="icon" style="font-size:18px">{@html getIconSvg("material-symbols:settings")}</i>
          <span>站点配置</span>
        </button>
        <div class="popup-divider"></div>
        <a href="/" class="popup-item">
          <i class="icon" style="font-size:18px">{@html getIconSvg("material-symbols:home")}</i>
          <span>返回首页</span>
        </a>
        <button class="popup-item logout" onclick={handleLogout}>
          <i class="icon" style="font-size:18px">{@html getIconSvg("material-symbols:logout")}</i>
          <span>退出登录</span>
        </button>
      </div>
    {/if}

    <main class="main-content">
      <div class="content-card">
        {#if currentView === 'list'}
          <PostList onEdit={(slug) => navigate('editor', slug)} onNew={() => navigate('editor')} />
        {:else if currentView === 'editor'}
          <PostEditor slug={editingSlug} onBack={() => navigate('list')} onSaved={() => navigate('list')} />
        {:else if currentView === 'images'}
          <ImageManager />
        {:else if currentView === 'config'}
          <ConfigEditor />
        {/if}
      </div>
    </main>
  </div>
{/if}

<style>
  .wallpaper-fixed { position: fixed; inset: 0; z-index: 0; }
  .wp-slide {
    position: absolute; inset: 0; opacity: 0;
    transition: opacity 1.2s ease-in-out; z-index: 1;
  }
  .wp-slide.active { opacity: 1; z-index: 2; }
  .wp-slide img { width: 100%; height: 100%; object-fit: cover; }
  .wp-dim { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.35); z-index: 3; }

  .admin-layout { position: relative; z-index: 10; min-height: 100vh; }

  /* ===== Desktop Navbar ===== */
  .navbar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 80; height: 4.5rem;
    transition: background 0.36s, backdrop-filter 0.36s, box-shadow 0.36s, transform 0.36s;
  }
  .navbar.scrolled {
    background: rgba(255, 255, 255, 0.55); backdrop-filter: blur(20px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }
  .navbar.hidden { transform: translateY(-100%); }
  :root.dark .navbar.scrolled { background: rgba(0, 0, 0, 0.55); }

  .navbar-inner {
    display: flex; align-items: center; height: 100%;
    max-width: var(--page-width, 100%); margin: 0 auto; padding: 0 1.5rem;
  }

  .navbar-brand {
    display: flex; align-items: center; gap: 10px;
    text-decoration: none; flex-shrink: 0; margin-right: 2rem;
  }
  .navbar-logo { width: 32px; height: 32px; border-radius: 8px; }
  .navbar-title {
    font-size: 1.1rem; font-weight: 700; color: white;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    transition: color 0.36s, text-shadow 0.36s;
  }
  .navbar.scrolled .navbar-title { color: var(--content-meta); text-shadow: none; }

  .navbar-nav { display: flex; gap: 4px; }

  .nav-btn {
    padding: 8px 14px; border-radius: var(--radius-xl);
    background: transparent; color: rgba(255, 255, 255, 0.85);
    border: none; cursor: pointer; font-size: 13px; font-weight: 500;
    transition: background 0.2s, color 0.2s; white-space: nowrap;
  }
  .nav-btn:hover { background: rgba(255, 255, 255, 0.15); color: white; }
  .nav-btn.active { background: rgba(255, 255, 255, 0.2); color: white; font-weight: 600; }
  .navbar.scrolled .nav-btn { color: var(--content-meta); }
  .navbar.scrolled .nav-btn:hover { background: var(--btn-plain-bg-hover); color: var(--content-meta); }
  .navbar.scrolled .nav-btn.active { background: var(--btn-regular-bg); color: var(--btn-content); }

  .navbar-right { display: flex; align-items: center; gap: 4px; margin-left: auto; }

  .nav-icon {
    display: flex; align-items: center; justify-content: center;
    width: 36px; height: 36px; border-radius: var(--radius-xl);
    background: transparent; color: rgba(255, 255, 255, 0.85);
    border: none; cursor: pointer; text-decoration: none;
    transition: background 0.2s, color 0.2s;
  }
  .nav-icon:hover { background: rgba(255, 255, 255, 0.15); color: white; }
  .navbar.scrolled .nav-icon { color: var(--content-meta); }
  .navbar.scrolled .nav-icon:hover { background: var(--btn-plain-bg-hover); color: var(--content-meta); }

  .hamburger {
    display: none; align-items: center; justify-content: center;
    width: 36px; height: 36px; border-radius: var(--radius-xl);
    background: transparent; color: rgba(255, 255, 255, 0.85);
    border: none; cursor: pointer;
  }
  .hamburger:hover { background: rgba(255, 255, 255, 0.15); }
  .navbar.scrolled .hamburger { color: var(--content-meta); }
  .navbar.scrolled .hamburger:hover { background: var(--btn-plain-bg-hover); }
  @media (max-width: 767px) { .navbar { display: none; } }
  @media (min-width: 768px) { .hamburger { display: none; } }

  /* ===== Mobile Topbar ===== */
  .mobile-topbar {
    display: none; position: fixed; top: 0; left: 0; right: 0; z-index: 85;
    align-items: center; justify-content: space-between;
    height: 52px; padding: 0 16px;
    background: transparent;
    transition: background 0.3s, backdrop-filter 0.3s, transform 0.3s;
  }
  .mobile-topbar.scrolled {
    background: rgba(255, 255, 255, 0.55); backdrop-filter: blur(20px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  .mobile-topbar.hidden { transform: translateY(-100%); }
  :root.dark .mobile-topbar.scrolled { background: rgba(0, 0, 0, 0.55); }

  .mobile-brand {
    display: flex; align-items: center; gap: 8px;
    text-decoration: none; color: white;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    transition: color 0.3s, text-shadow 0.3s;
  }
  .mobile-topbar.scrolled .mobile-brand { color: var(--content-meta); text-shadow: none; }
  .mobile-logo { width: 28px; height: 28px; border-radius: 6px; }
  .mobile-brand-text { font-size: 14px; font-weight: 700; }

  .mobile-topbar-right { display: flex; align-items: center; gap: 4px; }

  .mobile-theme-btn {
    display: flex; align-items: center; justify-content: center;
    width: 36px; height: 36px; border-radius: var(--radius-xl);
    background: rgba(255, 255, 255, 0.2); color: white;
    border: none; cursor: pointer;
  }
  .mobile-theme-btn:hover { background: rgba(255, 255, 255, 0.3); }
  .mobile-topbar.scrolled .mobile-theme-btn {
    background: var(--btn-regular-bg); color: var(--btn-content);
  }

  .mobile-hamburger {
    display: flex; align-items: center; justify-content: center;
    width: 36px; height: 36px; border-radius: var(--radius-xl);
    background: rgba(255, 255, 255, 0.2); color: white;
    border: none; cursor: pointer;
  }
  .mobile-hamburger:hover { background: rgba(255, 255, 255, 0.3); }
  .mobile-topbar.scrolled .mobile-hamburger {
    background: var(--btn-regular-bg); color: var(--btn-content);
  }

  @media (min-width: 768px) { .mobile-topbar { display: none !important; } }
  @media (max-width: 767px) { .mobile-topbar { display: flex; } }

  /* ===== Popup Menu (Firefly float-panel style) ===== */
  .menu-overlay { display: none; }
  .popup-menu { display: none; }

  @media (max-width: 767px) {
    .menu-overlay {
      display: block; position: fixed; inset: 0;
      background: rgba(0, 0, 0, 0.3); z-index: 90;
      border: none; cursor: pointer;
    }
    .popup-menu {
      display: flex; flex-direction: column;
      position: fixed; top: 4.5rem; right: 1rem;
      min-width: fit-content; background: var(--card-bg);
      border-radius: var(--radius-large);
      box-shadow: var(--shadow-xl);
      border: 1px solid rgba(0, 0, 0, 0.05);
      z-index: 100; padding: 0.5rem;
      max-height: 80vh; overflow-y: auto;
      animation: popIn 0.15s ease-out;
    }
    :root.dark .popup-menu { border-color: rgba(255, 255, 255, 0.1); }
  }
  @media (min-width: 768px) {
    .popup-menu {
      display: flex; flex-direction: column;
      position: fixed; top: 4.5rem; right: 1.5rem;
      min-width: fit-content; background: var(--card-bg);
      border-radius: var(--radius-large);
      box-shadow: var(--shadow-xl);
      border: 1px solid rgba(0, 0, 0, 0.05);
      z-index: 100; padding: 0.5rem;
      max-height: 80vh; overflow-y: auto;
      animation: popIn 0.15s ease-out;
    }
    :root.dark .popup-menu { border-color: rgba(255, 255, 255, 0.1); }
  }

  @keyframes popIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .popup-item {
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.5rem 0.75rem; border-radius: var(--radius-lg);
    background: transparent; color: var(--content-meta);
    border: none; cursor: pointer; font-size: 13px; font-weight: 700;
    text-decoration: none; transition: background 0.15s, color 0.15s;
    text-align: left; width: 100%;
  }
  .popup-item:hover { background: var(--btn-plain-bg-hover); color: var(--primary); }
  .popup-item.active { background: var(--btn-regular-bg); color: var(--btn-content); }
  .popup-item.logout { color: var(--admonitions-color-caution); }
  .popup-divider { height: 1px; background: var(--line-divider); margin: 4px 8px; }

  .main-content { padding-top: calc(4.5rem + 2rem); min-height: 100vh; }
  .content-card {
    max-width: var(--page-width, 100%); margin: 0 auto; padding: 0 1.5rem 3rem;
  }
  @media (max-width: 767px) {
    .main-content { padding-top: calc(4.5rem + 1rem); }
    .content-card { padding: 0 1rem 2rem; }
  }
</style>
