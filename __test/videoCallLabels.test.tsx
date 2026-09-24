import React, {useRef} from 'react'
import {fireEvent, render, screen} from '@testing-library/react'
import {
    VideoCall,
    useVideoCallController,
    videoCallLabelsEn,
    type VideoCallLabels,
    type VideoCallPhase,
    type VideoCallProps,
} from '../packages/wenay-calls/src/index.js'

const noop = () => {}
const participants: VideoCallProps['participants'] = [
    {id: 'self', initials: 'VE', name: 'Vera', moderator: true},
    {id: 'anna', initials: 'AN', name: 'Anna', hand: true},
    {id: 'bob', initials: 'BO', name: 'Bob', away: true, canSpeak: false},
]

function Call({labels, phase = 'active', rooms}: {labels?: Partial<VideoCallLabels>; phase?: VideoCallPhase; rooms?: VideoCallProps['rooms']}) {
    const controller = useVideoCallController({phase, speakerId: 'self', controlsHideMs: 0})
    const canvasRef = useRef<HTMLCanvasElement>(null)
    return <VideoCall controller={controller} phase={phase} labels={labels}
        meeting={{title: 'Standup', participantCount: phase === 'active' ? undefined : 3}}
        participants={participants} selfParticipantId="self" canvasRef={canvasRef}
        cameraState="idle" microphoneState="idle" moderator
        messages={[{id: 'm1', author: 'Anna', text: 'Hi'}]}
        rooms={rooms ?? [{id: 'r1', name: 'Design', participantIds: ['anna'], allowGuests: true}]}
        poll={{question: 'Move it?', options: [{id: 'y', label: 'Yes'}]}}
        recording={{state: 'recording', downloadUrl: 'blob:recording'}}
        assistant={{supported: true, listening: false, transcript: 'open chat'}}
        translationEnabled onToggleTranslation={noop} onToggleRecording={noop} onToggleScreenShare={noop}
        onAssistantCommand={noop} onToggleAssistant={noop} onSendMessage={noop} onInvite={noop}
        onJoinRoom={noop} onLeaveRoom={noop} onPingRoom={noop} onToggleSpeak={noop}
        onJoin={noop} onHangup={noop} onToggleCamera={noop} onToggleMicrophone={noop} />
}

const cyrillic = /[А-Яа-яЁё]/

test('English labels leave no Russian text in the lobby, the call and every panel', () => {
    const {container, unmount} = render(<Call labels={videoCallLabelsEn} phase="lobby" />)
    expect(screen.getByRole('button', {name: 'Join'})).toBeTruthy()
    expect(container.innerHTML).not.toMatch(cyrillic)
    unmount()

    const call = render(<Call labels={videoCallLabelsEn} />)
    const html = () => call.container.innerHTML
    expect(screen.getByRole('button', {name: 'Leave'})).toBeTruthy()
    expect(screen.getByText('3 participants')).toBeTruthy()
    expect(html()).not.toMatch(cyrillic)
    const open = [
        () => fireEvent.click(screen.getByRole('button', {name: 'Chat'})),
        () => fireEvent.click(screen.getByRole('button', {name: 'Rooms'})),
        () => fireEvent.click(screen.getByRole('button', {name: 'Call menu'})),
        () => fireEvent.click(screen.getByRole('button', {name: '♟ Participants and speaking rights'})),
        () => {
            fireEvent.click(screen.getByRole('button', {name: 'Call menu'}))
            fireEvent.click(screen.getByRole('button', {name: '🎙 Voice assistant'}))
        },
    ]
    for (const step of open) {
        step()
        expect(call.container.querySelector('.wenayVideoCallSidePanel')).not.toBeNull()
        expect(html()).not.toMatch(cyrillic)
    }
    expect(screen.getByRole('button', {name: 'open chat'})).toBeTruthy()
})

test('a partial override keeps the Russian defaults for every other text', () => {
    render(<Call labels={{hangup: 'Выйти из звонка'}} />)
    expect(screen.getByRole('button', {name: 'Выйти из звонка'})).toBeTruthy()
    expect(screen.getByRole('button', {name: 'Включить микрофон'})).toBeTruthy()
    expect(screen.queryByRole('button', {name: 'Завершить'})).toBeNull()
})

test('room sizes use the plural rule of the labels', () => {
    render(<Call rooms={[
        {id: 'r1', name: 'Один', participantIds: ['a']},
        {id: 'r2', name: 'Два', participantIds: ['a', 'b']},
        {id: 'r5', name: 'Пять', participantIds: ['a', 'b', 'c', 'd', 'e']},
    ]} />)
    fireEvent.click(screen.getByRole('button', {name: 'Комнаты'}))
    expect(screen.getByText('1 участник · закрытая')).toBeTruthy()
    expect(screen.getByText('2 участника · закрытая')).toBeTruthy()
    expect(screen.getByText('5 участников · закрытая')).toBeTruthy()
})
