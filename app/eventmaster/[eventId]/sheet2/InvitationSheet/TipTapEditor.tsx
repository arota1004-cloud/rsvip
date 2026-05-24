'use client'

import { useEditor, EditorContent, Node, mergeAttributes, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { useEffect, useRef, useCallback, type DragEvent } from 'react'

// ─── 변수 토큰 커스텀 노드 ────────────────────────────────────────────────────
function TokenView({ node }: { node: { attrs: { name: string } } }) {
  return (
    <NodeViewWrapper as="span" style={{ display: 'inline' }}>
      <span
        contentEditable={false}
        style={{
          display: 'inline-block', padding: '1px 8px', borderRadius: 9999,
          backgroundColor: 'rgba(255,92,26,0.12)', color: '#FF5C1A',
          fontSize: 12, fontWeight: 600, userSelect: 'none', cursor: 'default',
          lineHeight: 1.6,
        }}
      >
        {`{${node.attrs.name}}`}
      </span>
    </NodeViewWrapper>
  )
}

const TokenNode = Node.create({
  name: 'token',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return { name: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'span[data-token]', getAttrs: el => ({ name: (el as HTMLElement).dataset.token }) }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-token': HTMLAttributes.name, class: 'inv-token' }),
      `{${HTMLAttributes.name}}`,
    ]
  },
  addNodeView() {
    return ReactNodeViewRenderer(TokenView as any)
  },
})

// ─── Props ───────────────────────────────────────────────────────────────────
type Props = {
  html: string
  onChange: (html: string) => void
  availableTokens: string[]
  sampleRow: Record<string, string>  // colName → sample value (for preview mode)
  readOnly?: boolean
  confirmedInviteEnabled?: boolean   // QR 토큰 버튼 활성화 여부
}

type EditorHandle = {
  insertToken: (name: string) => void
  getHTML: () => string
}

// ─── 메인 에디터 컴포넌트 ─────────────────────────────────────────────────────
export default function TipTapEditor({ html, onChange, availableTokens, sampleRow, readOnly = false, confirmedInviteEnabled = false }: Props) {
  const isDraggingRef = useRef(false)
  const handleRef = useRef<EditorHandle | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Image.configure({ inline: false, allowBase64: true }),
      Placeholder.configure({ placeholder: '초대장 내용을 입력하세요. 우측 변수 버튼으로 {이름} 같은 토큰을 삽입할 수 있습니다.' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TokenNode,
    ],
    content: html,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  // 외부 html prop 변경 시 동기화 (다른 배리에이션 선택 시)
  const lastHtmlRef = useRef(html)
  useEffect(() => {
    if (editor && html !== lastHtmlRef.current && html !== editor.getHTML()) {
      editor.commands.setContent(html)
      lastHtmlRef.current = html
    }
  }, [html, editor])

  // 토큰 삽입 핸들
  useEffect(() => {
    handleRef.current = {
      insertToken: (name: string) => {
        editor?.chain().focus().insertContent({ type: 'token', attrs: { name } }).run()
      },
      getHTML: () => editor?.getHTML() ?? '',
    }
  })

  // 이미지 드래그앤드롭 처리
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault()
      isDraggingRef.current = true
    }
  }
  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    isDraggingRef.current = false
    const file = e.dataTransfer.files[0]
    if (!file?.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = ev => {
      const src = ev.target?.result as string
      editor?.chain().focus().setImage({ src }).run()
    }
    reader.readAsDataURL(file)
  }, [editor])

  if (!editor) return null

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ border: '1px solid rgba(61,26,46,0.12)', borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff' }}
    >
      {/* 툴바 */}
      {!readOnly && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 3, padding: '6px 10px',
          borderBottom: '1px solid rgba(61,26,46,0.1)', flexWrap: 'wrap',
          backgroundColor: '#faf8f4', flexShrink: 0,
        }}>
          {/* 포맷 버튼 */}
          <TBtn active={editor.isActive('bold')} onMouseDown={() => editor.chain().focus().toggleBold().run()} title="굵게">B</TBtn>
          <TBtn active={editor.isActive('italic')} onMouseDown={() => editor.chain().focus().toggleItalic().run()} title="기울임" style={{ fontStyle: 'italic' }}>I</TBtn>
          <TBtn active={editor.isActive('strike')} onMouseDown={() => editor.chain().focus().toggleStrike().run()} title="취소선" style={{ textDecoration: 'line-through' }}>S</TBtn>
          <Div />
          <TBtn active={editor.isActive('heading', { level: 1 })} onMouseDown={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="H1">H1</TBtn>
          <TBtn active={editor.isActive('heading', { level: 2 })} onMouseDown={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="H2">H2</TBtn>
          <TBtn active={editor.isActive('paragraph')} onMouseDown={() => editor.chain().focus().setParagraph().run()} title="본문">P</TBtn>
          <Div />
          <TBtn active={editor.isActive({ textAlign: 'left' })} onMouseDown={() => editor.chain().focus().setTextAlign('left').run()} title="왼쪽 정렬">≡</TBtn>
          <TBtn active={editor.isActive({ textAlign: 'center' })} onMouseDown={() => editor.chain().focus().setTextAlign('center').run()} title="가운데 정렬">☰</TBtn>
          <TBtn active={editor.isActive('bulletList')} onMouseDown={() => editor.chain().focus().toggleBulletList().run()} title="목록">•—</TBtn>
          <Div />

          {/* 이미지 삽입 */}
          <TBtn
            onMouseDown={() => {
              const input = document.createElement('input')
              input.type = 'file'; input.accept = 'image/*'
              input.onchange = () => {
                const file = input.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = ev => {
                  editor.chain().focus().setImage({ src: ev.target?.result as string }).run()
                }
                reader.readAsDataURL(file)
              }
              input.click()
            }}
            title="이미지 삽입"
          >🖼</TBtn>
          <Div />

          {/* 변수 토큰 버튼들 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
            {availableTokens.length > 0 && (
              <>
                <span style={{ fontSize: 10, color: 'rgba(61,26,46,0.4)', marginRight: 2 }}>변수:</span>
                {availableTokens.map(name => (
                  <button
                    key={name}
                    onMouseDown={e => {
                      e.preventDefault()
                      editor.chain().focus().insertContent({ type: 'token', attrs: { name } }).run()
                    }}
                    style={{
                      padding: '1px 8px', fontSize: 11, borderRadius: 9999,
                      border: '1px solid rgba(255,92,26,0.4)',
                      backgroundColor: 'rgba(255,92,26,0.06)',
                      color: '#FF5C1A', fontWeight: 600, cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,92,26,0.14)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255,92,26,0.06)')}
                  >
                    {name}
                  </button>
                ))}
                <Div />
              </>
            )}
            {/* QR 토큰 버튼 — 확정 인비테이션 ON일 때만 활성 */}
            <button
              title={confirmedInviteEnabled ? 'QR 체크인 코드 삽입' : '기본 설정 > 확정 인비테이션을 먼저 활성화하세요'}
              onMouseDown={e => {
                e.preventDefault()
                if (!confirmedInviteEnabled) return
                editor.chain().focus().insertContent({ type: 'token', attrs: { name: 'QR' } }).run()
              }}
              style={{
                padding: '1px 8px', fontSize: 11, borderRadius: 9999,
                border: `1px solid ${confirmedInviteEnabled ? 'rgba(61,26,46,0.35)' : 'rgba(61,26,46,0.15)'}`,
                backgroundColor: confirmedInviteEnabled ? 'rgba(61,26,46,0.05)' : 'rgba(0,0,0,0.02)',
                color: confirmedInviteEnabled ? '#3D1A2E' : 'rgba(61,26,46,0.3)',
                fontWeight: 600, cursor: confirmedInviteEnabled ? 'pointer' : 'not-allowed',
              }}
              onMouseEnter={e => { if (confirmedInviteEnabled) e.currentTarget.style.backgroundColor = 'rgba(61,26,46,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = confirmedInviteEnabled ? 'rgba(61,26,46,0.05)' : 'rgba(0,0,0,0.02)' }}
            >
              📷 QR{!confirmedInviteEnabled && ' 🔒'}
            </button>
          </div>
        </div>
      )}

      {/* 편집 영역 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <EditorContent editor={editor} style={{ minHeight: 200, outline: 'none' }} />
      </div>

      <style>{`
        .tiptap { outline: none; }
        .tiptap p { margin: 0 0 8px; font-size: 14px; line-height: 1.7; color: #3D1A2E; }
        .tiptap h1 { font-size: 24px; font-weight: 700; margin: 16px 0 10px; color: #3D1A2E; }
        .tiptap h2 { font-size: 20px; font-weight: 700; margin: 14px 0 8px; color: #3D1A2E; }
        .tiptap h3 { font-size: 16px; font-weight: 600; margin: 12px 0 6px; color: #3D1A2E; }
        .tiptap img { max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0; display: block; }
        .tiptap ul { padding-left: 20px; margin: 0 0 8px; }
        .tiptap li { margin: 2px 0; font-size: 14px; color: #3D1A2E; }
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left; color: rgba(61,26,46,0.3); pointer-events: none; height: 0;
        }
        .tiptap .inv-token {
          display: inline-block; padding: 1px 8px; border-radius: 9999px;
          background: rgba(255,92,26,0.12); color: #FF5C1A; font-size: 12px; font-weight: 600;
        }
      `}</style>
    </div>
  )
}

// ─── 헬퍼 컴포넌트 ────────────────────────────────────────────────────────────
function TBtn({ children, onMouseDown, title, active, style }: {
  children: React.ReactNode; onMouseDown: () => void; title?: string
  active?: boolean; style?: React.CSSProperties
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onMouseDown() }}
      title={title}
      style={{
        padding: '3px 7px', fontSize: 12, borderRadius: 5, cursor: 'pointer',
        border: `1px solid ${active ? '#FF5C1A' : 'rgba(61,26,46,0.15)'}`,
        backgroundColor: active ? 'rgba(255,92,26,0.08)' : 'transparent',
        color: active ? '#FF5C1A' : '#3D1A2E',
        minWidth: 26, fontWeight: 500,
        ...style,
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = 'rgba(61,26,46,0.05)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent' }}
    >{children}</button>
  )
}

function Div() {
  return <div style={{ width: 1, height: 18, backgroundColor: 'rgba(61,26,46,0.15)', margin: '0 2px' }} />
}
