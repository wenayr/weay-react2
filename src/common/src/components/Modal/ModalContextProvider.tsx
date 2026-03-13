import React, { createContext, useContext, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {DivOutsideClick} from "../../hooks";

// Контекст хранит только функцию setModal
const ModalContext = createContext<(jsx: ReactNode | null) => void>(() => {});

export const ModalProvider = ({ children }: { children: ReactNode }) => {
    const [modal, setModal] = useState<ReactNode | null>(null);
    return (
        <ModalContext.Provider value={setModal}>
            {children}
            {modal && createPortal(
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.5)'
                }}>
                    <DivOutsideClick outsideClick={() => setModal(null)} status={true}>
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