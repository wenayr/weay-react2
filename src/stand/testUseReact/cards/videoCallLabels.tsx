import React, {useRef, useState} from 'react';
import {
    VideoCall,
    useVideoCallController,
    videoCallLabelsEn,
    type VideoCallLabels,
    type VideoCallMessage,
    type VideoCallPhase,
} from 'wenay-calls';
import {Check, DemoHint, ExampleCode} from '../standKit.js';

const languages: Record<'ru' | 'en' | 'custom', {name: string; labels?: Partial<VideoCallLabels>}> = {
    ru: {name: 'Русский (по умолчанию)'},
    en: {name: 'English', labels: videoCallLabelsEn},
    custom: {name: 'Свои подписи', labels: {brand: 'Acme Calls', join: 'Войти в эфир', hangup: 'Покинуть эфир', chat: 'Лента'}},
};
// App data (names, messages) is the application's own and is not translated by labels.
const participants = [
    {id: 'self', initials: 'MA', name: 'Maria', tone: 'violet' as const, moderator: true},
    {id: 'anna', initials: 'AN', name: 'Anna', tone: 'green' as const, hand: true},
    {id: 'lee', initials: 'LE', name: 'Lee', tone: 'amber' as const},
];

function LabelsDemo() {
    const [language, setLanguage] = useState<keyof typeof languages>('en');
    const [phase, setPhase] = useState<VideoCallPhase>('lobby');
    const [messages, setMessages] = useState<VideoCallMessage[]>([{id: 'm1', author: 'Anna', text: 'Starting in a minute'}]);
    const [lastCommand, setLastCommand] = useState('—');
    const controller = useVideoCallController({phase, speakerId: 'anna', controlsHideMs: 0});
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const labels = languages[language].labels;
    return <div>
        <div style={{display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8}}>
            {(Object.keys(languages) as Array<keyof typeof languages>).map(key =>
                <button key={key} aria-pressed={language === key} onClick={() => setLanguage(key)}>{languages[key].name}</button>)}
            <button onClick={() => setPhase(phase === 'active' ? 'lobby' : 'active')}>
                {phase === 'active' ? 'Вернуться в лобби' : 'Войти в звонок'}
            </button>
        </div>
        <div style={{height: 520}}>
            <VideoCall controller={controller} phase={phase} labels={labels}
                meeting={{title: 'Weekly sync', participantCount: 2}}
                participants={participants} selfParticipantId="self" canvasRef={canvasRef}
                cameraState="idle" microphoneState="idle" moderator messages={messages}
                rooms={[{id: 'design', name: 'Design', participantIds: ['anna'], allowGuests: true}]}
                assistant={{supported: false, listening: false}}
                onAssistantCommand={setLastCommand}
                onSendMessage={text => setMessages(list => [...list, {id: String(list.length + 1), author: 'Maria', text}])}
                onJoin={() => setPhase('active')} onHangup={() => setPhase('lobby')}
                onToggleCamera={() => {}} onToggleMicrophone={() => {}}
                onJoinRoom={() => {}} onLeaveRoom={() => {}} onPingRoom={() => {}} />
        </div>
        <p role="status" aria-label="Последняя команда ассистента">Команда ассистента, которую получило приложение: {lastCommand}</p>
        <DemoHint>Библиотека владеет только текстами и визуальным состоянием. Звонок, медиа, права и разбор
            команд ассистента остаются у приложения: `assistantCommands` уходят в `onAssistantCommand` как есть.</DemoHint>
        <ExampleCode>{`import {VideoCall, videoCallLabelsEn} from 'wenay-calls';
<VideoCall labels={videoCallLabelsEn} {...callProps} />            // ready English set
<VideoCall labels={{hangup: 'Leave', join: 'Enter'}} {...callProps} /> // any subset, the rest stays Russian`}</ExampleCode>
    </div>;
}

export function Card60() {
    return <Check n={60} id="video-call-labels" title="VideoCall — interface language (labels)"
        do="Switch English / Russian / custom labels in the lobby and in the call; open chat, rooms, menu and the assistant; send a chat message; click an assistant command."
        expect="English leaves no Russian text or aria-label in the call surface; custom labels change only the four overridden texts; the app receives the command text of the current language."
        note="Public wenay-calls entry; no media or network is used." tall><LabelsDemo/></Check>;
}
