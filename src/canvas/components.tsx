import type { TLComponents } from 'tldraw'
import { BlueprintBackground } from './BlueprintBackground'

/**
 * Replace tldraw's chrome wholesale. We keep the editor (and crucially its
 * keyboard shortcuts, which `hideUi` would kill) but null out every default
 * panel and menu, then render our own dock + top bar as siblings of <Tldraw>.
 * The one component we *swap* rather than hide is the Background.
 */
export const blueprintComponents: TLComponents = {
  Background: BlueprintBackground,
  Grid: null,
  Toolbar: null,
  StylePanel: null,
  PageMenu: null,
  NavigationPanel: null,
  MainMenu: null,
  ActionsMenu: null,
  QuickActions: null,
  HelpMenu: null,
  ZoomMenu: null,
  Minimap: null,
  DebugPanel: null,
  DebugMenu: null,
  MenuPanel: null,
  TopPanel: null,
  SharePanel: null,
  HelperButtons: null,
  CursorChatBubble: null,
}
