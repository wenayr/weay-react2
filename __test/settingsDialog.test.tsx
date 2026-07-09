import React from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import {SettingsDialog, type SettingsSection} from "../src/common/src/components/Settings/SettingsDialog";

const sections: SettingsSection[] = [
    {
        key: "general",
        name: "General",
        render: () => React.createElement("div", null, "General content"),
        children: [
            {
                key: "indexing",
                name: "Indexing",
                render: () => React.createElement("div", null, "Indexing content"),
                children: [
                    {
                        key: "suffix",
                        name: "Suffix tree",
                        searchText: "suffix trie tokens",
                        render: () => React.createElement("div", null, "Suffix content"),
                    },
                ],
            },
        ],
    },
    {
        key: "display",
        name: "Display",
        render: () => React.createElement("div", null, "Display content"),
    },
];

test("SettingsDialog updates floating window content when search state changes", () => {
    render(React.createElement(SettingsDialog, {sections, defaultSection: "general"}));

    fireEvent.click(screen.getByRole("button", {name: "Open settings"}));
    expect(screen.getByText("General content")).toBeTruthy();

    fireEvent.change(screen.getByRole("textbox", {name: "Search settings"}), {target: {value: "suffix"}});

    expect(screen.getByText("Suffix content")).toBeTruthy();
    expect(screen.queryByText("Display")).toBeNull();
});