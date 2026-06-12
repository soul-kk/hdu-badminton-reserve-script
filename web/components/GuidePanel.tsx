'use client';

import { useState } from 'react';

type DeviceTab = 'windows' | 'macos' | 'ios' | 'android';

const DEVICE_TABS: { key: DeviceTab; label: string; icon: string }[] = [
  { key: 'windows', label: 'Windows', icon: '🪟' },
  { key: 'macos', label: 'macOS', icon: '🍎' },
  { key: 'ios', label: 'iOS', icon: '📱' },
  { key: 'android', label: 'Android', icon: '🤖' },
];

function TokenGuide() {
  const [activeDevice, setActiveDevice] = useState<DeviceTab>('windows');

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex border-b border-gray-200 bg-gray-50">
        {DEVICE_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveDevice(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${activeDevice === tab.key
              ? 'bg-white text-blue-600 border-b-2 border-blue-500'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="px-5 py-4 text-sm text-gray-700 space-y-2.5">
        {activeDevice === 'windows' && (
          <ol className="space-y-2">
            <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold">1</span><span><a href="/downloads/get_token_win.zip" className="text-blue-600 underline underline-offset-2">点击下载windows抓token工具</a>，然后解压</span></li>
            <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold">2</span><span>首次运行时，需要<strong>右键 → 以管理员身份运行</strong></span></li>
            <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold">3</span><span>根据提示拿到 token</span></li>
          </ol>
        )}
        {activeDevice === 'macos' && (
          <ol className="space-y-2">
            <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold">1</span><span><a href="/downloads/get_token_mac.zip" className="text-blue-600 underline underline-offset-2">点击下载macOS抓token工具</a>，然后解压</span></li>
            <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold">2</span><span>直接双击打开</span></li>
            <li className="flex gap-2"><span className="shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-bold">3</span><span>根据提示拿到 token</span></li>
          </ol>
        )}
        {activeDevice === 'ios' && (
          <div className="flex items-start gap-3 py-1">
            <span className="text-2xl">📱</span>
            <p className="text-gray-500 leading-relaxed">iPhone 上需要一些额外配置，体验不佳，建议使用电脑。<br />如果确实需要，请直接联系 kk 获取方案。</p>
          </div>
        )}
        {activeDevice === 'android' && (
          <div className="flex items-start gap-3 py-1">
            <span className="text-2xl">🤖</span>
            <p className="text-gray-500 leading-relaxed">安卓手机暂无使用方案，建议使用电脑。</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function GuidePanel() {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0">1</span>
          抓取 Token
        </h3>
        <TokenGuide />
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <span className="shrink-0 text-base">⏰</span>
          <p><strong>重要：</strong>Token 有效期只有 <strong>5 小时</strong>！请<strong>下午 3 点之后</strong>再抓取 token，否则到晚上 8 点抢场时 token 已过期，会导致预约失败。</p>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0">2</span>
          提交预约
        </h3>
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-700 space-y-2">
          <p>打开预约界面，将 token 完整粘贴到输入框。</p>
          <p>填好日期和时间段，点击开启任务即可。</p>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0">3</span>
          查看结果 &amp; 邀请好友
        </h3>
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-700 space-y-2">
          <p>晚上 8 点记得回来查看结果。</p>
          <p className="text-red-600 font-medium">⚠ 如果预约成功，需要在 10 分钟之内去钉钉里手动邀请好友！</p>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-gray-800 mb-3">常见问题</h3>
        <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100 text-sm">
          <details className="group px-5 py-3">
            <summary className="cursor-pointer font-medium text-gray-700 list-none flex items-center justify-between">
              token 是什么？
              <span className="text-gray-400 group-open:rotate-180 transition-transform text-xs">▼</span>
            </summary>
            <p className="mt-2 text-gray-500 leading-relaxed">是预约系统中你的用户凭证，相当于你的登录身份标识。有效的 token 是预约成功的前提，token 过期或无效都会导致抢场失败。</p>
          </details>
          <details className="group px-5 py-3">
            <summary className="cursor-pointer font-medium text-gray-700 list-none flex items-center justify-between">
              为什么会预约失败？
              <span className="text-gray-400 group-open:rotate-180 transition-transform text-xs">▼</span>
            </summary>
            <p className="mt-2 text-gray-500 leading-relaxed">常见原因：<strong>403</strong> 是服务器限流，<strong>502/500</strong> 是服务器错误，这两种情况系统会自动重试。<strong>401</strong> 是 token 无效或已过期，会直接失败，请确保下午 3 点后再抓取 token。</p>
          </details>
          <details className="group px-5 py-3">
            <summary className="cursor-pointer font-medium text-gray-700 list-none flex items-center justify-between">
              需要一直开着预约网页吗？
              <span className="text-gray-400 group-open:rotate-180 transition-transform text-xs">▼</span>
            </summary>
            <p className="mt-2 text-gray-500 leading-relaxed">不需要。任务跑在服务器上，开启后可以关掉窗口。8 点后回来查看结果即可，也可在【近期任务】中找到历史记录。</p>
          </details>
          <details className="group px-5 py-3">
            <summary className="cursor-pointer font-medium text-gray-700 list-none flex items-center justify-between">
              找不到钉钉里的「场馆速约」？
              <span className="text-gray-400 group-open:rotate-180 transition-transform text-xs">▼</span>
            </summary>
            <p className="mt-2 text-gray-500 leading-relaxed">先把企业/组织切换到【杭州电子科技大学】（杭电钉）→ 左侧点击【工作台】→ 右上角搜索「场馆速约」。</p>
          </details>
        </div>
      </section>
    </div>
  );
}
