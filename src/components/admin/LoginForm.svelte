<script lang="ts">
import { getIconSvg } from "@/constants/icons";
import { login } from "@/lib/api";

interface Props {
	onLogin: () => void;
}

let { onLogin }: Props = $props();

let username = $state("");
let password = $state("");
let error = $state("");
let loading = $state(false);

async function handleSubmit(e: Event) {
	e.preventDefault();
	error = "";
	loading = true;

	try {
		await login(username, password);
		onLogin();
	} catch (err: unknown) {
		error = err instanceof Error ? err.message : "连接失败，请检查网络";
		loading = false;
	}
}
</script>

<div class="login-page">
  <div class="login-card">
    <div class="login-header">
      <div class="login-icon">
        <i class="icon" style="font-size:28px">{@html getIconSvg("material-symbols:shield")}</i>
      </div>
      <h2 class="login-title">博客管理后台</h2>
      <p class="login-subtitle">请登录以继续</p>
    </div>

    <form onsubmit={handleSubmit} class="login-form">
      <div class="form-group">
        <label class="form-label" for="admin-username">用户名</label>
        <input
          id="admin-username"
          type="text"
          bind:value={username}
          class="form-input"
          placeholder="输入用户名"
          required
        />
      </div>
      <div class="form-group">
        <label class="form-label" for="admin-password">密码</label>
        <input
          id="admin-password"
          type="password"
          bind:value={password}
          class="form-input"
          placeholder="输入密码"
          required
        />
      </div>

      {#if error}
        <p class="form-error">{error}</p>
      {/if}

      <button
        type="submit"
        disabled={loading}
        class="form-button"
      >
        {loading ? '登录中...' : '登录系统'}
      </button>
    </form>
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--page-bg);
  }

  .login-card {
    background: var(--card-bg);
    border-radius: var(--radius-2xl);
    box-shadow: var(--shadow-lg);
    padding: 40px 32px;
    width: 100%;
    max-width: 380px;
    border: 1px solid var(--line-divider);
  }

  .login-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .login-icon {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-full);
    background: var(--btn-regular-bg);
    color: var(--btn-content);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
  }

  .login-title {
    font-size: 22px;
    font-weight: 700;
    color: var(--deep-text);
    margin: 0 0 4px;
  }

  .login-subtitle {
    font-size: 14px;
    color: var(--content-meta);
    margin: 0;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .login-form .form-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--content-meta);
  }

  .form-error {
    color: var(--admonitions-color-caution);
    font-size: 13px;
    margin: 0;
  }

  .form-button {
    padding: 10px 0;
    background: var(--primary);
    color: white;
    font-weight: 600;
    font-size: 14px;
    border: none;
    border-radius: var(--radius-xl);
    cursor: pointer;
    transition: opacity 150ms;
  }
  .form-button:hover {
    opacity: 0.9;
  }
  .form-button:disabled {
    opacity: 0.5;
  }
</style>
