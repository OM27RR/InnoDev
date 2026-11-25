import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { javascript } from '@codemirror/lang-javascript'
import { yCollab } from 'y-codemirror.next'

// --- room comes from the URL: http://localhost:5173/#my-room
if (!location.hash) location.hash = crypto.randomUUID()
const room = location.hash.slice(1) || 'default-room'

const ydoc = new Y.Doc()
new IndexeddbPersistence('editor-' + room, ydoc)
const wsUrl = import.meta.env.VITE_WS_URL || `ws://${location.hostname}:1234`
const params = new URLSearchParams(window.location.search)
const roomName = params.get('room') || 'default-innodev-room'

const wsProvider = new WebsocketProvider(
  'wss://innodev.onrender.com',
  roomName,
  doc
)
provider.on('status', e => {
  document.getElementById('status').textContent = e.status
})

// --- shared text: this IS the code file
const ytext = ydoc.getText('code')

// --- who am I? (shown on my cursor and in the user list)
const colors = ['#30bced', '#6eeb83', '#ffbc42', '#ecd444', '#ee6352', '#9ac2c9', '#8acb88', '#1be7ff']
const color = colors[Math.floor(Math.random() * colors.length)]
const name = prompt('Your name?') || 'Anonymous-' + Math.floor(Math.random() * 100)

const awareness = provider.awareness
awareness.setLocalStateField('user', { name, color, colorLight: color + '33' })
awareness.setLocalStateField('status', 'idle')

// --- "typing..." status: set when I edit, reset after 1.5s
let idleTimer
const activityListener = EditorView.updateListener.of(update => {
  // only edits made locally by this user, not remote changes applied by Yjs
  const isMine = update.transactions.some(tr =>
    tr.isUserEvent('input') ||   // typing, pasting
    tr.isUserEvent('delete') ||  // backspace, delete
    tr.isUserEvent('undo') ||
    tr.isUserEvent('redo')
  )
  if (!isMine) return

  awareness.setLocalStateField('status', 'typing')
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => awareness.setLocalStateField('status', 'idle'), 1500)
})

// --- editor
const state = EditorState.create({
  doc: ytext.toString(),
  extensions: [
    basicSetup,
    javascript(),
    yCollab(ytext, awareness), // syncs text + draws remote cursors/selections
    activityListener,
  ],
})
new EditorView({ state, parent: document.getElementById('editor') })

// --- online users list
function renderUsers() {
  const box = document.getElementById('users')
  box.innerHTML = ''
  awareness.getStates().forEach((s, clientId) => {
    if (!s.user) return
    const el = document.createElement('span')
    el.className = 'user'
    el.style.background = s.user.color
    const me = clientId === ydoc.clientID ? ' (you)' : ''
    el.textContent = `${s.user.name}${me} · ${s.status || 'idle'}`
    box.append(el)
  })
}
awareness.on('change', renderUsers)
renderUsers()