import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BindingEditor } from '../packages/watch/client-settings/lib/client/role-bindings.js'
import { BindingStore } from '../packages/watch/client-settings/lib/client/binding-state.js'
import { isExecutable } from '../packages/watch/contracts/lib/readiness.js'

const model = id => ({ id, name: id })
const direct = ['MiniMax-M2.7', 'MiniMax-M3', 'MiniMax-M3.1-Flash', 'custom-text', 'speech-02-hd']
function render(provider, ids, selected = '', role = 'agent_model') {
  const models = ids.map(model)
  const html = renderToStaticMarkup(createElement(BindingEditor, {
    row: { role, provider, model: selected || null },
    providers: [{ provider, displayName: provider, models, credential: 'configured_unverified', catalogError: null }],
    saving: false, onBind() {}, onCancel() {},
  }))
  assert.deepEqual(models, ids.map(model), 'rendering must not mutate the runtime catalogue')
  const select = html.match(/<select[^>]*>[\s\S]*?<\/select>/g)[1]
  return { html, choices: [...select.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]) }
}

describe('MiniMax chat recommendations in the actual role editor', () => {
  for (const provider of ['minimax', 'minimax-cn']) {
    test(`${provider} displays resolvable Flash first, M3 second, and preserves custom/media IDs`, () => {
      assert.deepEqual(render(provider, direct).choices, ['MiniMax-M3.1-Flash', 'MiniMax-M3', 'custom-text', 'speech-02-hd'])
    })
    test(`${provider} retains the exact selected legacy ID`, () => {
      const result = render(provider, direct, 'MiniMax-M2.7')
      assert.ok(result.choices.includes('MiniMax-M2.7'))
      assert.match(result.html, /value="MiniMax-M2.7" selected=""/)
    })
  }
  test('never fabricates support for a model absent from the runtime', () => {
    assert.deepEqual(render('minimax', ['MiniMax-M2.7', 'MiniMax-M3']).choices, ['MiniMax-M3'])
    const empty = render('minimax', ['MiniMax-M2.7'])
    assert.deepEqual(empty.choices, [])
    assert.match(empty.html, /No current chat recommendations/)
  })
  test('retains a saved custom selection absent from the current catalogue without claiming it is advertised', () => {
    const result = render('minimax', direct, 'my-private-model')
    assert.ok(result.choices.includes('my-private-model'))
    assert.match(result.html, /my-private-model \(saved selection\)/)
  })
  test('OpenRouter uses the verified free Flash route and leaves other providers in the list', () => {
    assert.deepEqual(render('openrouter', ['openai/gpt-4o', 'minimax/minimax-m2.7', 'minimax/minimax-m3', 'minimax/minimax-m3.1-flash:free']).choices,
      ['minimax/minimax-m3.1-flash:free', 'minimax/minimax-m3', 'openai/gpt-4o'])
  })
  test('older Text-01 recommendations are hidden while saved choices and media remain available', () => {
    assert.deepEqual(render('minimax', ['MiniMax-Text-01', 'speech-02-hd', 'MiniMax-M3']).choices,
      ['MiniMax-M3', 'speech-02-hd'])
    assert.ok(render('minimax', ['MiniMax-Text-01'], 'MiniMax-Text-01').choices.includes('MiniMax-Text-01'))
    assert.deepEqual(render('openrouter', ['minimax/minimax-01', 'minimax/video-01', 'minimax/minimax-m3']).choices,
      ['minimax/minimax-m3', 'minimax/video-01'])
  })
  test('OpenCode Zen uses its own verified Flash spelling', () => {
    assert.deepEqual(render('opencode', ['minimax-m2.7', 'minimax-m3', 'minimax-m3.1-flash-free', 'gpt-5']).choices,
      ['minimax-m3.1-flash-free', 'minimax-m3', 'gpt-5'])
  })
  test('unknown gateway and non-MiniMax routes are unchanged', () => {
    for (const provider of ['custom', 'openai', 'opencode-go']) {
      assert.deepEqual(render(provider, direct).choices, direct)
    }
  })
  test('every non-chat role retains the complete catalogue', () => {
    for (const role of ['visual_perception', 'asr', 'audio_understanding', 'embeddings']) {
      assert.deepEqual(render('minimax', direct, '', role).choices, direct)
    }
  })
})

const ok = value => ({ result: { ok: true, value } })
test('actual BindingStore writes the exact choice over the settings API without replacing the provider profile', async () => {
  const models = direct.map(model)
  const profile = { profiles: { minimax: { apiKeyEnv: 'MINIMAX_API_KEY' } } }
  const writes = []
  const namespaces = [{ ns: 'llm-pi-ai', value: profile, revision: 1 }]
  const api = {
    settings: {
      describe: async () => ok({ writable: true, namespaces }),
      replace: async payload => {
        writes.push(JSON.parse(JSON.stringify(payload)))
        const index = namespaces.findIndex(item => item.ns === payload.ns)
        const item = { ns: payload.ns, value: payload.section, revision: 2 }
        if (index === -1) namespaces.push(item)
        else namespaces[index] = item
        return ok(item)
      },
    },
    llm: {
      providers: async () => ok({ providers: [{ provider: 'minimax', displayName: 'MiniMax', settingsNs: 'llm-pi-ai', settingsPath: ['profiles', 'minimax'], active: true }] }),
      models: async () => ok({ groups: [{ id: 'minimax', name: 'MiniMax', models }], failures: [] }),
    },
    credentials: { describe: async ({ refs }) => ok({ credentials: Object.fromEntries(refs.map(ref => [ref, { configured: true, writable: true }])) }) },
  }
  const store = new BindingStore(api)
  await store.load()
  for (const id of ['MiniMax-M3.1-Flash', 'MiniMax-M3', 'MiniMax-M2.7', 'custom-text']) {
    await store.bind('agent_model', 'minimax', id)
    assert.equal(store.getSnapshot().roles.find(row => row.role === 'agent_model').model, id)
    assert.deepEqual(store.getSnapshot().providers[0].models, models)
    assert.equal(isExecutable(store.getSnapshot().roles.find(row => row.role === 'agent_model').readiness), false)
    const selection = writes.findLast(write => write.ns === 'agent-default-model')
    assert.equal(selection.section.model, id)
    assert.equal(selection.section.provider, 'minimax')
  }
  assert.ok(writes.every(write => ['watch-bindings', 'agent-default-model'].includes(write.ns)))
  assert.deepEqual(namespaces[0].value, profile)
})
