import { Component } from 'react';
import type { ReactNode } from 'react';

/** Loading/rendering failures must preserve the shared lesson state. */
export class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onFailure: (reason: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure('입체 표시를 불러오지 못했습니다. 같은 리듬의 평면 표시로 계속할 수 있어요.'); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
