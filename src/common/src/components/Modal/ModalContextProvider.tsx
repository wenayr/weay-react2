import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {OutsideClickArea} from "../../hooks/useOutside";
import {tokens} from "../../styles/tokens";

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

    useEffect(() => {
        if (!modal || !closeOnEscape) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key == 'Escape') setModal(null);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [modal, closeOnEscape]);

    return (
        <ModalContext.Provider value={modalApi}>
            {children}
            {modal && createPortal(
                <div style={{
                    position: 'fixed', inset: 0, zIndex: tokens.zIndex.modal,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'var(--dlg-scrim, rgba(0, 0, 0, 0.5))'
                }}>
                    <OutsideClickArea outsideClick={() => { if (closeOnOutsideClick) setModal(null); }} status={true}>
                        {modal}
                    </OutsideClickArea>
                </div>,
                document.body
            )}
        </ModalContext.Provider>
    );
};

export const useModal = () => useContext(ModalContext);