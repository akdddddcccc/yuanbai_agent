import { Component, Suspense } from 'react';
import './scene-boundary.css';

export function simpleView() {
  return new URLSearchParams(globalThis.location?.search || '').get('view') === 'lite';
}

export function SceneFallback({ error, loading = false }) {
  return <div className="scene-fallback" role="status">
    <img src={`${import.meta.env.BASE_URL}brand/yuanbai-mark.svg`} alt="元白楼" />
    <p>{loading ? '建筑正在加载，页面可继续使用。' : '建筑动画暂未开启，页面可继续使用。'}</p>
    {loading && <a href="?view=lite">使用简洁模式</a>}
    {error && <details><summary>查看加载问题</summary><pre>{String(error.message || error).slice(0, 300)}</pre></details>}
  </div>;
}

// Keep rejected lazy imports and scene effect failures inside the visual panel.
export class SceneBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.warn('Yuanbai scene unavailable', error); }
  render() {
    if (this.state.error || simpleView()) return <SceneFallback error={this.state.error} />;
    return <Suspense fallback={<SceneFallback loading />}>{this.props.children}</Suspense>;
  }
}

export class PageBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error('Yuanbai page failed', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return <main className="page-fallback" role="alert">
      <h1>页面暂未能打开</h1>
      <p>请尝试重新加载；如果仍有问题，可将下方错误信息发给我们。</p>
      <a href="?view=lite">重新加载简洁模式</a>
      <a href="/yuanbai/game/?from=home">进入探索元白</a>
      <details open><summary>加载问题</summary><pre>{String(this.state.error.message || this.state.error).slice(0, 300)}</pre></details>
    </main>;
  }
}
