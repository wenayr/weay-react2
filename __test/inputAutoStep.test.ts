import {setAutoStepForElement} from "../src/internal/utils/inputAutoStep";

// The change handler used to write parseFloat("").toFixed(d) - the literal string
// "NaN" - into the field, and to write `stepDefault + ""` even when the element
// carried no step attribute at all, producing step="null".

function numberInput(attrs: {value?: string, step?: string, min?: string, max?: string}) {
    const el = document.createElement("input");
    el.type = "number";
    if (attrs.step != undefined) el.step = attrs.step;
    if (attrs.min != undefined) el.min = attrs.min;
    if (attrs.max != undefined) el.max = attrs.max;
    el.value = attrs.value ?? "";
    document.body.appendChild(el);
    return el;
}

afterEach(() => { document.body.innerHTML = ""; });

test("clearing the field does not write the string NaN into it", () => {
    const el = numberInput({step: "0.1", value: "0.55"});
    const dispose = setAutoStepForElement(el);

    el.dispatchEvent(new Event("keyup"));   // arms digitsCurrent from the typed value
    el.value = "";
    el.dispatchEvent(new Event("change"));

    expect(el.value).not.toBe("NaN");
    expect(el.value).toBe("");
    dispose();
});

test("a value below min still rounds through the normal path", () => {
    const el = numberInput({step: "0.1", min: "10", value: "5"});
    const dispose = setAutoStepForElement(el);

    el.dispatchEvent(new Event("change"));

    expect(el.value).toBe("10");
    expect(el.min).toBe("10");
    dispose();
});

test("an element without a step attribute never gets step=\"null\"", () => {
    const el = numberInput({min: "10", value: "5"});
    expect(el.hasAttribute("step")).toBe(false);
    const dispose = setAutoStepForElement(el);

    el.dispatchEvent(new Event("change"));

    expect(el.getAttribute("step")).not.toBe("null");
    expect(el.hasAttribute("step")).toBe(false);
    expect(el.value).toBe("10");
    dispose();
});

test("an element with a step attribute keeps it when clamped to min", () => {
    const el = numberInput({step: "0.25", min: "10", value: "5"});
    const dispose = setAutoStepForElement(el);

    el.dispatchEvent(new Event("change"));

    expect(el.getAttribute("step")).toBe("0.25");
    dispose();
});
