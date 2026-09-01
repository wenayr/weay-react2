import React from "react";
import {renderToString} from "react-dom/server";
import {useUpdateBy} from "../src/internal/updateBy";

test("useUpdateBy provides a stable server snapshot", () => {
    const model = {};

    function Probe() {
        useUpdateBy(model);
        return <span>server subscriber</span>;
    }

    expect(renderToString(<Probe/>)).toContain("server subscriber");
});
