import React, {useRef} from 'react'
import {fireEvent, render, screen} from '@testing-library/react'
import {
    VideoCall,
    type VideoCallAssistant,
    useVideoCallController,
} from '../src/internal/components/Communication/VideoCall'

type HarnessProps = {
    assistant?: VideoCallAssistant
    onAssistantCommand?: (command: string) => void
    onToggleAssistant?: () => void
}

function Harness({assistant, onAssistantCommand, onToggleAssistant}: HarnessProps) {
    const controller = useVideoCallController({phase: 'active', speakerId: 'self'})
    const canvasRef = useRef<HTMLCanvasElement>(null)

    return <>
        <button onClick={() => controller.setPanel('assistant')}>Открыть ассистента</button>
        <VideoCall
            controller={controller}
            phase="active"
            meeting={{brand: 'Test', title: 'Test call'}}
            participants={[{id: 'self', initials: 'Я', name: 'Я'}]}
            selfParticipantId="self"
            canvasRef={canvasRef}
            cameraState="idle"
            microphoneState="idle"
            assistant={assistant}
            onJoin={() => {}}
            onHangup={() => {}}
            onToggleCamera={() => {}}
            onToggleMicrophone={() => {}}
            onAssistantCommand={onAssistantCommand}
            onToggleAssistant={onToggleAssistant}
        />
    </>
}

test('typed assistant integration does not render a dead voice control', () => {
    const onAssistantCommand = jest.fn()
    render(<Harness
        assistant={{supported: false, listening: false, status: 'Только текст'}}
        onAssistantCommand={onAssistantCommand}
    />)

    fireEvent.click(screen.getByRole('button', {name: 'Открыть ассистента'}))
    expect(screen.queryByRole('button', {name: 'Сказать команду'})).toBeNull()

    const input = screen.getByRole('textbox', {name: 'Команда ассистенту'})
    fireEvent.change(input, {target: {value: 'открой чат'}})
    fireEvent.click(screen.getByRole('button', {name: 'Выполнить команду'}))
    expect(onAssistantCommand).toHaveBeenCalledWith('открой чат')
})

test('voice assistant exposes toggle and live status semantics', () => {
    const onToggleAssistant = jest.fn()
    render(<Harness
        assistant={{supported: true, listening: true, status: 'Распознавание активно'}}
        onAssistantCommand={() => {}}
        onToggleAssistant={onToggleAssistant}
    />)

    fireEvent.click(screen.getByRole('button', {name: 'Открыть ассистента'}))
    const toggle = screen.getByRole('button', {name: 'Остановить распознавание'})
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(toggle)
    expect(onToggleAssistant).toHaveBeenCalledTimes(1)

    const status = screen.getByRole('status')
    expect(status.textContent).toBe('Распознавание активно')
    expect(status.getAttribute('aria-live')).toBe('polite')
})
