import React, { createContext, useContext, useMemo, useState, ReactNode } from 'react';
import {tokens} from "../../styles/tokens";
import {Overlay} from "../Overlay";

export type ModalApi = {
    show(node: ReactNode): void;
    open(node: ReactNode): void;
    close(): void;
    replace(node: ReactNode | null): void;
    set(node: ReactNode | null): void;
};

export type ModalController = ((jsx: ReactNode | null) => void) & ModalApi;

const noopModal = Object.assign(() => {}, {show() {}, open() {}, close() {}, replace() {}, set() {}}) as ModalController;
const ModalContext = createContext<ModalController>(noopModal);

export type ModalProviderProps = {
    children: ReactNode;
    closeOnOutsideClick?: boolean;
    closeOnEscape?: boolean;
};

export const ModalProvider = ({ children, closeOnOutsideClick = true, closeOnEscape = true }: ModalProviderProps) => {
    const [modal, setModal] = useState<ReactNode | null>(null);
    const modalApi = useMemo<ModalController>(() => {
        const api = ((node: ReactNode | null) => setModal(node)) as ModalController;
        api.show = (node) => setModal(node);
        api.open = api.show;
        api.close = () => setModal(null);
        api.replace = (node) => setModal(node);
        api.set = api.replace;
        return api;
    }, []);

    return (
        <ModalContext.Provider value={modalApi}>
            {children}
            {modal && (
                <Overlay
                    scrimStyle={{
                        position: 'fixed', inset: 0, zIndex: tokens.zIndex.modal,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: 'var(--dlg-scrim, rgba(0, 0, 0, 0.5))'
                    }}
                    onEscape={closeOnEscape ? () => setModal(null) : undefined}
                    onOutsideClick={() => { if (closeOnOutsideClick) setModal(null); }}
                >
                    {modal}
                </Overlay>
            )}
        </ModalContext.Provider>
    );
};

export const useModal = () => useContext(ModalContext);