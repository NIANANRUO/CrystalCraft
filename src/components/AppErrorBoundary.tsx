import React from 'react';

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, { error: string | null }> {
  state: { error: string | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : '未知界面错误' };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <main className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-6">
      <div role="alert" className="max-w-lg space-y-4">
        <h1 className="text-xl font-bold">界面遇到异常</h1>
        <p>请重新加载页面后恢复已保存的项目；最近尚未保存的更改可能丢失。</p>
        <pre className="whitespace-pre-wrap break-words text-sm">{this.state.error}</pre>
        <button className="rounded bg-slate-800 text-white px-4 py-2" onClick={() => window.location.reload()}>重新加载</button>
      </div>
    </main>;
  }
}
