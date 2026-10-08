"use client";

import { Component, type ReactNode } from "react";

type SceneErrorBoundaryProps = {
  children: ReactNode;
  onError: (error: Error) => void;
};

type SceneErrorBoundaryState = {
  hasFailed: boolean;
};

/**
 * Catches render-time failures inside the WebGL scene (unsupported canvas
 * APIs, shader compilation, lost context on mount) so the app can fall back
 * to the 2D list instead of unmounting the whole page.
 */
export class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, SceneErrorBoundaryState> {
  state: SceneErrorBoundaryState = { hasFailed: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { hasFailed: true };
  }

  componentDidCatch(error: Error) {
    console.error("3D 전시관 렌더링에 실패해 작품 목록으로 전환합니다.", error);
    this.props.onError(error);
  }

  render() {
    return this.state.hasFailed ? null : this.props.children;
  }
}
