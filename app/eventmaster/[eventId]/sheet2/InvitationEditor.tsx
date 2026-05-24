'use client'

import { useRef, useEffect, useCallback, useState } from 'react'

type Props = {
  html: string
  onChange: (html: string) => void
  availableTokens: string[]  // 컬럼 이름 목록 → {이름} 형식
}

export default function InvitationEditor({ html, onChange, availableTokens }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [showTokenMenu, setShowTokenMenu] = useState(false)
  const lastHtml = useRef(html)

  // 외부 html 변경 시 에디터 동기화 (편집 중 아닐 때만)
  useEffect(() => {
    if (editorRef.current && html !== lastHtml.current) {
      editorRef.current.innerHTML = html
      lastHtml.current = html
    }
  }, [html])

  const handleInput = () => {
    const content = editorRef.current?.innerHTML ?? ''
    lastHtml.current = content
    onChange(content)
  }

  const exec = useCallback((cmd: string, value?: string) => {
    document.execCommand(cmd, false, value)
    editorRef.current?.focus()
  }, [])

  // 변수 토큰 삽입
  const insertToken = (colName: string) => {
    const token = `<span class="inv-token" style="display:inline-block;padding:1px 7px;border-radius:9999px;background:rgba(255,92,26,0.12);color:#FF5C1A;font-size:12px;font-weight:600;">{${colName}}</span>`
    editorRef.current?.focus()
    document.execCommand('insertHTML', false, token)
    setShowTokenMenu(false)
    handleInput()
  }

  // 이미지 삽입 (base64 미리보기 - 실제 스토리지 업로드는 Phase 4.5에서)
  const insertImage = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = e => {
        const src = e.target?.result as string
        exec('insertHTML', `<img src="${src}" style="max-width:100%;height:auto;border-radius:8px;margin:4px 0;" />`)
        handleInput()
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  const ToolBtn = ({ label, cmd, val, title }: { label: string; cmd?: string; val?: string; title?: string }) => (
    <button
      onMouseDown={e => { e.preventDefault(); cmd && exec(cmd, val) }}
      title={title ?? label}
      style={{
        padding: '3px 8px', fontSize: 12, borderRadius: 5, cursor: 'pointer',
        border: '1px solid rgba(61,26,46,0.15)', background: 'none', color: '#3D1A2E',
        minWidth: 28, fontWeight: cmd === 'bold' ? 700 : cmd === 'italic' ? undefined : 400,
        fontStyle: cmd === 'italic' ? 'italic' : 'normal',
      }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(61,26,46,0.06)')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {label}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid rgba(61,26,46,0.12)', borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff' }}>
      {/* 툴바 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px',
        borderBottom: '1px solid rgba(61,26,46,0.1)', flexWrap: 'wrap', flexShrink: 0,
        backgroundColor: '#faf8f4',
      }}>
        <ToolBtn label="B" cmd="bold" title="굵게" />
        <ToolBtn label="I" cmd="italic" title="기울임" />
        <ToolBtn label="U" cmd="underline" title="밑줄" />
        <div style={{ width: 1, height: 18, backgroundColor: 'rgba(61,26,46,0.15)', margin: '0 4px' }} />
        <ToolBtn label="H1" cmd="formatBlock" val="h2" title="제목" />
        <ToolBtn label="본문" cmd="formatBlock" val="p" title="본문" />
        <ToolBtn label="≡" cmd="justifyLeft" title="왼쪽 정렬" />
        <ToolBtn label="≡" cmd="justifyCenter" title="가운데 정렬" />
        <div style={{ width: 1, height: 18, backgroundColor: 'rgba(61,26,46,0.15)', margin: '0 4px' }} />

        {/* 이미지 삽입 */}
        <button
          onMouseDown={e => { e.preventDefault(); insertImage() }}
          style={{ padding: '3px 8px', fontSize: 12, borderRadius: 5, cursor: 'pointer', border: '1px solid rgba(61,26,46,0.15)', background: 'none', color: '#3D1A2E' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(61,26,46,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          🖼 이미지
        </button>

        {/* 변수 토큰 삽입 */}
        <div style={{ position: 'relative' }}>
          <button
            onMouseDown={e => { e.preventDefault(); setShowTokenMenu(v => !v) }}
            style={{
              padding: '3px 8px', fontSize: 12, borderRadius: 5, cursor: 'pointer',
              border: '1px solid rgba(255,92,26,0.4)', background: 'none', color: '#FF5C1A', fontWeight: 600,
            }}
          >
            {'{ }'} 변수
          </button>
          {showTokenMenu && availableTokens.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 50,
              backgroundColor: '#fff', border: '1px solid rgba(61,26,46,0.15)',
              borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              padding: '4px 0', minWidth: 140, marginTop: 4,
            }}>
              {availableTokens.map(col => (
                <button
                  key={col}
                  onMouseDown={e => { e.preventDefault(); insertToken(col) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#3D1A2E' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,92,26,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <span style={{ color: '#FF5C1A', fontWeight: 600 }}>{`{${col}}`}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 편집 영역 */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onClick={() => setShowTokenMenu(false)}
        data-placeholder="초대장 내용을 입력하세요. {이름}처럼 변수를 삽입하면 발송 시 자동으로 치환됩니다."
        style={{
          flex: 1, padding: '20px 24px',
          outline: 'none', overflowY: 'auto',
          fontSize: 14, lineHeight: 1.7, color: '#3D1A2E',
          minHeight: 300,
        }}
      />

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: rgba(61,26,46,0.3);
          pointer-events: none;
        }
        [contenteditable] h2 { font-size: 20px; font-weight: 700; margin: 12px 0 8px; }
        [contenteditable] p  { margin: 0 0 8px; }
        [contenteditable] img { max-width: 100%; }
      `}</style>
    </div>
  )
}
