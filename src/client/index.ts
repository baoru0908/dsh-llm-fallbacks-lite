import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ISessions, SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { bindSnapshotSelector } from './use-snapshot.ts'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-api-remotes/types'
import type {} from '@deepseek-ai/dsh-settings/types'
import type {} from '@deepseek-ai/dsh-llm/types'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { FallbacksCard } from './FallbacksCard.tsx'
import { GeneralFallbacksRow } from './GeneralFallbacksRow.tsx'
import {
  ConversationFallbackSwitch, fallbackSwitchDefinition,
} from './ConversationFallbackSwitch.tsx'
import { SubagentRoleBadge } from './SubagentRoleBadge.tsx'
import {
  FallbacksSettingsController, FALLBACKS_SETTINGS_NS,
  refreshCatalogIfLoaded, refreshFallbacksIfLoaded, refreshSwitchesIfLoaded,
  type FallbacksRemote,
} from './fallbacks-store.ts'
import { en, NS, zh } from './locales.ts'

export type { FallbacksCardInjected, FallbacksCardProps } from './FallbacksCard.tsx'
export type { GeneralFallbacksRowInjected, GeneralFallbacksRowProps } from './GeneralFallbacksRow.tsx'
export type {
  ConversationFallbackSwitchProps, FallbacksSwitchChatData,
} from './ConversationFallbackSwitch.tsx'
export type { SubagentRoleBadgeProps } from './SubagentRoleBadge.tsx'
export type { FallbacksSettingsState } from './fallbacks-store.ts'
export { FallbacksSettingsController, FALLBACKS_SETTINGS_NS } from './fallbacks-store.ts'

export const inject = ['slots', 'locale', 'connection', 'remote', 'uiConversation', 'remote.llm', 'remote.settings', 'remote.session']

function viewedSessionId(state: SessionListState): SessionId | undefined {
  if (!Array.isArray(state?.ids)) return undefined
  for (const id of state.ids) {
    const row = state.byId[id]
    const mainView = (row?.retainedBy as { mainView?: number } | undefined)?.mainView ?? 0
    if (row !== undefined && mainView > 0) return id
  }
  return undefined
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'llm-fallbacks: dictionaries')

  const connection = ctx.get('connection') as ConnectionHandle
  const sessions = ctx.get('sessions') as unknown as ISessions | undefined
  const controller = new FallbacksSettingsController(
    ctx.remote as unknown as FallbacksRemote,
    connection.rpc,
  )
  const useSnapshot = bindSnapshotSelector(controller.store)

  ctx.effect(() => {
    const syncSession = (): void => {
      controller.setCurrentSession(sessions === undefined ? undefined : viewedSessionId(sessions.list.getSnapshot()))
    }
    if (sessions !== undefined) syncSession()
    const refresh = (ns?: string): void => {
      if (ns !== undefined && ns !== FALLBACKS_SETTINGS_NS) return
      refreshFallbacksIfLoaded(controller)
      refreshSwitchesIfLoaded(controller)
    }
    const refreshCatalog = (): void => { refreshCatalogIfLoaded(controller) }
    let pendingReset = false
    let disposed = false
    const refreshAll = (): void => {
      if (pendingReset) return
      pendingReset = true
      queueMicrotask(() => {
        pendingReset = false
        if (disposed) return
        refresh()
        refreshCatalog()
      })
    }
    const disposers = [
      ctx.remote.$on('settings/document-updated', refresh),
      ctx.remote.$on('llm/adapters-updated', refreshCatalog),
      ctx.on('connection/reset', refreshAll),
      ...(sessions === undefined ? [] : [sessions.list.subscribe(syncSession)]),
    ]
    return () => {
      disposed = true
      for (const dispose of disposers) dispose()
      controller.dispose()
    }
  }, 'llm-fallbacks: pushed invalidations')

  const BUNDLE_NAME = 'dsh-llm-fallbacks'
  ctx.slots.inject('plugins.bundle.config', function* () {
    yield ctx.slots.register({
      name: 'plugins.bundle.config',
      key: BUNDLE_NAME,
      locale: NS,
      inject: () => ({ controller, hooks: { snapshot: controller.store } }),
    }, FallbacksCard)
  })

  ctx.slots.inject('settings.general.item', function* () {
    yield ctx.slots.register({
      name: 'settings.general.item',
      id: 'fallbacks',
      order: 100,
      locale: NS,
      inject: () => ({ controller, useSnapshot }),
    }, GeneralFallbacksRow)
  })

  // Self-use fork: dshnext Settings page "Web UI plugins" section seat
  // (`web-ui.plugin.item`, declared by @linxin666/dsh-client-ui-web-ui-settings).
  // The family seat `settings.plugin.item` was removed in alpha.2; the
  // @deepseek-ai peer types don't declare this @linxin666 slot, so we cast to
  // the seat name (runtime-safe: dshnext renders `renderSlot("web-ui.plugin.item")`).
  ctx.slots.inject('web-ui.plugin.item' as any, function* () {
    yield ctx.slots.register({
      name: 'web-ui.plugin.item' as any,
      id: 'fallbacks',
      order: 105,
      locale: NS,
      inject: () => ({ controller, useSnapshot }),
    }, FallbacksCard as any)
  })

  ctx.effect(
    () => ctx.uiConversation.events.register(fallbackSwitchDefinition),
    'llm-fallbacks: conversation node definition',
  )
  ctx.slots.inject('conversation.chat.node', function* () {
    yield ctx.slots.register({
      name: 'conversation.chat.node',
      key: 'fallbacks-switch',
      locale: NS,
    }, ConversationFallbackSwitch)
  })

  ctx.slots.inject('conversation.session.header.actions', function* () {
    yield ctx.slots.register({
      name: 'conversation.session.header.actions',
      id: 'fallbacks-subagent-role',
      order: -5,
      locale: NS,
    }, SubagentRoleBadge)
  })
}
