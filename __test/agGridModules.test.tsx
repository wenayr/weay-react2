import React from 'react'
import {render} from '@testing-library/react'
import {
    CsvExportModule,
    ModuleRegistry,
} from 'ag-grid-community'
import {GridStyleDefault} from '../src/internal/styles/styleGrid'
import {
    defaultAgGridModules,
    ensureAgGridModules,
} from '../src/internal/grid/agGrid4/modules'

let lastAgGridProps: Record<string, unknown> | undefined

jest.mock('ag-grid-react', () => ({
    AgGridReact(props: Record<string, unknown>) {
        lastAgGridProps = props
        return <div data-testid="ag-grid-react" />
    },
}))

import {AgGridTable} from '../src/internal/grid/agGrid4/agGrid4'

test('default AG Grid modules are targeted and register only once', () => {
    const names = defaultAgGridModules.map(module => module.moduleName)

    expect(names).toEqual(expect.arrayContaining([
        'ClientSideRowModel',
        'ClientSideRowModelApi',
        'ColumnApi',
        'ColumnAutoSize',
        'EventApi',
        'RenderApi',
        'RowApi',
        'RowAutoHeight',
        'ScrollApi',
        'RowSelection',
        'CellStyle',
        'TextFilter',
        'NumberFilter',
        'DateFilter',
    ]))
    expect(names).not.toContain('AllCommunity')

    const register = jest.spyOn(ModuleRegistry, 'registerModules')
    ensureAgGridModules()
    ensureAgGridModules()

    expect(register).toHaveBeenCalledTimes(1)
    expect(register).toHaveBeenCalledWith(defaultAgGridModules)
})

test('GridStyleDefault configures the theme without registering feature modules', () => {
    const register = jest.spyOn(ModuleRegistry, 'registerModules')
    register.mockClear()

    const result = GridStyleDefault()

    expect(result.theme).toBeDefined()
    expect(register).not.toHaveBeenCalled()
})

test('AgGridTable forwards grid-specific modules to AgGridReact', () => {
    const modules = [CsvExportModule]
    render(<AgGridTable autoSizeColumns={false} modules={modules} rowData={[]} />)

    expect(lastAgGridProps?.modules).toBe(modules)
})
