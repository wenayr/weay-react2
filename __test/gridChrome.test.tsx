import React from 'react'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {createColumnState} from '../src/common/src/grid/columnState/columnState'
import {appendGridChromeMenuItem, createGridChrome, selectGridChromeContextRow} from '../src/common/src/grid/gridChrome'

afterEach(() => cleanup())

function createApi(rows: {id: string}[] = [{id: 'one'}]) {
    let selected: any[] = []
    return {
        getSelectedNodes: jest.fn(() => selected),
        getSelectedRows: jest.fn(() => selected.map(node => node.data)),
        setNodesSelected: jest.fn(({nodes, newValue, clearSelection}) => {
            if (clearSelection) selected = []
            if (newValue) selected = [...selected.filter(node => !nodes.includes(node)), ...nodes]
            else selected = selected.filter(node => !nodes.includes(node))
        }),
        autoSizeAllColumns: jest.fn(),
        sizeColumnsToFit: jest.fn(),
        rows,
    }
}

test('GridChrome opens from keyboard, groups commands, then closes on Escape and outside click', () => {
    const state = createColumnState({key: 'gridChrome.ui', columns: [{key: 'name', title: 'Name'}]})
    const api = createApi()
    const run = jest.fn()
    const chrome = createGridChrome({
        columnState: state,
        copy: jest.fn(),
        commands: [{key: 'app-refresh', group: 'table', name: 'Обновить', title: 'Обновить таблицу', run}],
    })
    chrome.grid.attach(api as any)
    const Chrome = chrome.Chrome
    render(<Chrome/>)

    const trigger = screen.getByRole('button', {name: 'Команды таблицы'})
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    fireEvent.keyDown(trigger, {key: 'Enter'})

    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Колонки')).toBeTruthy()
    expect(screen.getByText('Размер')).toBeTruthy()
    expect(screen.getByText('Данные')).toBeTruthy()
    expect(screen.getByText('Таблица')).toBeTruthy()
    expect(screen.getByRole('button', {name: 'Обновить'}).getAttribute('title')).toBe('Обновить таблицу')

    fireEvent.keyDown(document, {key: 'Escape'})
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)

    fireEvent.click(trigger)
    fireEvent.mouseDown(document.body)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
})

test('GridChrome keeps tap opening available and reports disabled commands without running them', () => {
    const run = jest.fn()
    const chrome = createGridChrome({
        commands: [{key: 'disabled', group: 'table', name: 'Недоступно', disabled: true, run}],
    })
    const Chrome = chrome.Chrome
    render(<Chrome/>)

    // The trigger is always in the DOM; CSS media queries decide fine-pointer hiding,
    // so a coarse-pointer/tap user never depends on hover to reach it.
    const trigger = screen.getByRole('button', {name: 'Команды таблицы'})
    fireEvent.click(trigger)
    const disabled = screen.getByRole('button', {name: 'Недоступно'})
    expect((disabled as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(disabled)
    expect(run).not.toHaveBeenCalled()
})

test('GridChrome grows through declarative collapsible command groups without changing commands', () => {
    const chrome = createGridChrome({
        commandGroups: [{key: 'export', label: 'Экспорт', order: 1, collapsible: true, defaultOpen: false}],
        commands: [{key: 'download', group: 'export', name: 'Скачать CSV', run: jest.fn()}],
    })
    const Chrome = chrome.Chrome
    render(<Chrome/>)

    fireEvent.click(screen.getByRole('button', {name: 'Команды таблицы'}))
    const group = screen.getByRole('button', {name: 'Экспорт'})
    expect(group.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById(group.getAttribute('aria-controls') ?? '')).toBeTruthy()
    expect(screen.queryByRole('button', {name: 'Скачать CSV'})).toBeNull()

    fireEvent.click(group)
    expect(screen.getByRole('button', {name: 'Экспорт'}).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('button', {name: 'Скачать CSV'})).toBeTruthy()
})

test('GridChrome runs injected column persistence and closes after a one-shot command', async () => {
    const saveColumns = jest.fn()
    const chrome = createGridChrome({
        columnState: createColumnState({key: 'gridChrome.save', columns: [{key: 'name', title: 'Name'}]}),
        saveColumns,
    })
    const Chrome = chrome.Chrome
    render(<Chrome/>)

    const trigger = screen.getByRole('button', {name: 'Команды таблицы'})
    fireEvent.click(trigger)
    await act(async () => {
        fireEvent.click(screen.getByRole('button', {name: 'Сохранить'}))
        await Promise.resolve()
    })
    expect(saveColumns).toHaveBeenCalledWith(expect.objectContaining({columnState: expect.any(Object)}))
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByRole('status').textContent).toBe('Сохранить')
})

test('GridChrome composes app context items, selects the clicked row, then copies that selection', async () => {
    const api = createApi()
    const row = {data: {id: 'two'}, isSelected: () => false}
    const copy = jest.fn()
    const menu: {openAt: jest.Mock} = {openAt: jest.fn(() => true)}
    const chrome = createGridChrome({copy, contextMenu: menu})
    chrome.grid.attach(api as any)
    const appItem = {name: 'Приложение'}

    chrome.api.openContextMenu({api: api as any, node: row, event: new MouseEvent('contextmenu', {clientX: 20, clientY: 30})}, [appItem])

    expect(api.setNodesSelected).toHaveBeenCalledWith({nodes: [row], newValue: true})
    const items = menu.openAt.mock.calls[0][1] as Array<{name: string, onClick: () => Promise<void>}>
    expect(items.map((item: {name: string}) => item.name)).toEqual(['Приложение', 'Копировать строки'])
    await items[1].onClick()
    expect(copy).toHaveBeenCalledWith(expect.objectContaining({rows: [{id: 'two'}], node: row}))
})

test('GridChrome selects the clicked row before asking the app to compose its context items', () => {
    const api = createApi()
    const row = {data: {id: 'two'}, isSelected: () => false}
    const contextItems = jest.fn(() => [{name: 'Приложение'}])
    const chrome = createGridChrome({contextItems})
    chrome.grid.attach(api as any)

    chrome.api.contextMenuItems({api: api as any, node: row})

    expect(api.setNodesSelected).toHaveBeenCalledWith({nodes: [row], newValue: true})
    expect(contextItems).toHaveBeenCalledWith(expect.objectContaining({api, node: row}))
})

test('GridChrome right-click makes the clicked row exclusive even after a multi-selection', () => {
    const api = createApi()
    const first = {data: {id: 'one'}, isSelected: () => true}
    const second = {data: {id: 'two'}, isSelected: () => true}
    const clicked = {data: {id: 'three'}, isSelected: () => false}
    api.setNodesSelected({nodes: [first, second], newValue: true})
    api.setNodesSelected.mockClear()

    selectGridChromeContextRow(api as any, clicked)

    expect(api.setNodesSelected).toHaveBeenNthCalledWith(1, {nodes: [first, second], newValue: false})
    expect(api.setNodesSelected).toHaveBeenLastCalledWith({nodes: [clicked], newValue: true})
    expect(api.getSelectedRows()).toEqual([{id: 'three'}])
})

test('GridChrome turns an already selected row into the sole selection after a context click', () => {
    const api = createApi()
    const first = {data: {id: 'one'}, isSelected: () => true}
    const clicked = {data: {id: 'two'}, isSelected: () => true}
    api.setNodesSelected({nodes: [first, clicked], newValue: true})
    api.setNodesSelected.mockClear()

    selectGridChromeContextRow(api as any, clicked)

    expect(api.setNodesSelected).toHaveBeenNthCalledWith(1, {nodes: [first], newValue: false})
    expect(api.setNodesSelected).toHaveBeenLastCalledWith({nodes: [clicked], newValue: true})
    expect(api.getSelectedRows()).toEqual([{id: 'two'}])
})

test('GridChrome copies only the context-clicked RowNode selection when the real row API is available', async () => {
    const api = createApi()
    const first = {data: {id: 'one'}}
    const row: {data: {id: string}, setSelected?: (selected: boolean, clearSelection?: boolean) => void} = {data: {id: 'two'}}
    row.setSelected = jest.fn((selected, clearSelection) => {
        if (clearSelection) api.setNodesSelected({nodes: api.getSelectedNodes(), newValue: false})
        api.setNodesSelected({nodes: [row], newValue: selected})
    })
    api.setNodesSelected({nodes: [first], newValue: true})
    const copy = jest.fn()
    const chrome = createGridChrome({copy})

    const items = chrome.api.contextMenuItems({api: api as any, node: row}) as Array<{name: string, onClick: () => Promise<void>}>
    await items[0].onClick()

    expect(row.setSelected).toHaveBeenCalledWith(true, true)
    expect(copy).toHaveBeenCalledWith(expect.objectContaining({rows: [{id: 'two'}], node: row}))
})

test('GridChrome leaves an already selected row intact and does not mutate app menu items', () => {
    const api = createApi()
    const row = {data: {id: 'one'}, isSelected: () => true}
    api.getSelectedNodes.mockReturnValue([row])
    selectGridChromeContextRow(api as any, row)
    expect(api.setNodesSelected).not.toHaveBeenCalled()

    const appItems = [{name: 'App item'}]
    const next = appendGridChromeMenuItem(appItems, {name: 'Copy item'})
    expect(next).toEqual([{name: 'App item'}, {name: 'Copy item'}])
    expect(appItems).toEqual([{name: 'App item'}])
})

test('GridChrome ignores stale destroy events and clears its API on dispose', () => {
    const chrome = createGridChrome<{id: string}>({})
    const apiA = createApi() as any
    const apiB = createApi() as any

    chrome.grid.attach(apiA)
    chrome.grid.attach(apiB)
    chrome.grid.detach(apiA)
    expect(chrome.api.getApi()).toBe(apiB)
    chrome.grid.detach(apiB)
    expect(chrome.api.getApi()).toBeNull()

    chrome.grid.attach(apiB)
    chrome.dispose()
    expect(chrome.api.getApi()).toBeNull()
})

test('GridChrome cleans document listeners across StrictMode remounts', () => {
    const add = jest.spyOn(document, 'addEventListener')
    const remove = jest.spyOn(document, 'removeEventListener')
    const chrome = createGridChrome<{id: string}>({})
    const Chrome = chrome.Chrome
    const view = render(<React.StrictMode><Chrome/></React.StrictMode>)

    fireEvent.click(screen.getByRole('button', {name: 'Команды таблицы'}))
    expect(add).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(add).toHaveBeenCalledWith('mousedown', expect.any(Function))
    expect(add).toHaveBeenCalledWith('touchstart', expect.any(Function))

    view.unmount()
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('mousedown', expect.any(Function))
    expect(remove).toHaveBeenCalledWith('touchstart', expect.any(Function))
    add.mockRestore()
    remove.mockRestore()
})
