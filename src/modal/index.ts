/** `wenay-react2/modal` (3.0.0) - the modal block: ModalProvider/useModal (context-owned modal
 *  slot), the input panels and their floating-window wrappers (TextInput / FileInput, FreeModal),
 *  the confirm/input helpers that render into a modal target, the element/render stores those
 *  helpers write to, and the LeftModal side-panel kit. Depends on ./react and ./windows
 *  (FloatingWindow, DragBox - so react-rnd is part of this entry); pulls no ag-grid and no
 *  grid/logs/chart/communication code. */

export {ModalProvider, useModal} from "../internal/components/Modal/ModalContextProvider.js";
export type {ModalApi, ModalController, ModalProviderProps} from "../internal/components/Modal/ModalContextProvider.js";
export {
    confirmModal,
    createModalElementStore,
    createModalRenderStore,
    inputModal,
} from "../internal/components/Modal/Modal.js";
export {LeftModal, getApiLeftMenu} from "../internal/components/Modal/LeftModal.js";
export {
    FileInputModal,
    FileInputPanel,
    FreeModal,
    TextInputModal,
    TextInputPanel,
    useFileInputPanel,
    useTextInputPanel,
} from "../internal/components/Input.js";
export type {FileInputPanelProps, TextInputPanelProps} from "../internal/components/Input.js";
