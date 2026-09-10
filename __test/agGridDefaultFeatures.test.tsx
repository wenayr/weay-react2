import React from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {AgGridTable} from '../src/grid/index.js';

// Real AG Grid in an isolated Jest module registry: no stand/global AllCommunity registration
// and no modules prop that could accidentally supply the missing baseline features.
test('default AgGridTable applies getRowStyle and renders tooltipValueGetter tooltips', async () => {
    const getRowStyle = jest.fn(() => ({backgroundColor: 'rgb(255, 230, 200)'}));
    const tooltipValueGetter = jest.fn(() => 'Account needs attention');
    const view = render(<div style={{width: 600, height: 300}}>
        <AgGridTable autoSizeColumns={false} rowData={[{id: 'one', name: 'Risk account'}]}
            columnDefs={[{field: 'name', tooltipValueGetter}]}
            getRowStyle={getRowStyle} tooltipShowDelay={0} tooltipHideDelay={10000}/>
    </div>);
    const cell = await screen.findByText('Risk account');
    await waitFor(() => {
        expect(getRowStyle).toHaveBeenCalled();
        expect(cell.closest('.ag-row')?.getAttribute('style')).toContain('background-color: rgb(255, 230, 200)');
    });
    fireEvent.mouseEnter(cell.closest('.ag-cell')!);
    await waitFor(() => expect(tooltipValueGetter).toHaveBeenCalled());
    expect(await screen.findByText('Account needs attention')).toBeTruthy();
    view.unmount();
});
