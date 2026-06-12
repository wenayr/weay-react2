import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {DivOutsideClick} from "../../hooks/useOutside";
import {tokens} from "../../styles/tokens";

// Контекст хранит только функцию setModal
const ModalContext = createContext<(jsx: ReactNode | null) => void>(() => {});

export type ModalProviderProps = {
    children: ReactNode;
    /** Закрывать по клику вне модалки. По умолчанию true (прежнее поведение). */
    closeOnOutsideClick?: boolean;
    /** Закрывать по Escape. По умолчанию true. */
    closeOnEscape?: boolean;
};

export const ModalProvider = ({ children, closeOnOutsideClick = true, closeOnEscape = true }: ModalProviderProps) => {
    const [modal, setModal] = useState<ReactNode | null>(null);

    useEffect(() => {
        if (!modal || !closeOnEscape) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key == 'Escape') setModal(null);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [modal, closeOnEscape]);

    return (
        <ModalContext.Provider value={setModal}>
            {children}
            {modal && createPortal(
                <div style={{
                    position: 'fixed', inset: 0, zIndex: tokens.zIndex.modal,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.5)'
                }}>
                    <DivOutsideClick outsideClick={() => { if (closeOnOutsideClick) setModal(null); }} status={true}>
                        {modal}
                    </DivOutsideClick>
                </div>,
                document.body
            )}
        </ModalContext.Provider>
    );
};

// Тот самый компактный хук
export const useModal = () => useContext(ModalContext);
