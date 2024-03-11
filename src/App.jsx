import { useLayoutEffect, useState } from "react";
import rough from "roughjs";

const generator = rough.generator();

function createElement(x1, y1, x2, y2, elementType) {
  const roughElement =
    elementType === "line"
      ? generator.line(x1, y1, x2, y2)
      : generator.rectangle(x1, y1, x2 - x1, y2 - y1);
  return { x1, y1, x2, y2, roughElement };
}

function App() {
  const [elements, setElement] = useState([]);
  const [drawing, setDrawing] = useState(false);
  const [elementType, setElementType] = useState("line");

  useLayoutEffect(() => {
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");

    context.clearRect(0, 0, canvas.width, canvas.height);

    const roughCanvas = rough.canvas(canvas);
    elements.forEach(({ roughElement }) => roughCanvas.draw(roughElement));
  }, [elements]);

  const handleMouseDown = (event) => {
    setDrawing(true);
    const { clientX, clientY } = event;
    const element = createElement(
      clientX,
      clientY,
      clientX,
      clientY,
      elementType
    );
    setElement((prevState) => [...prevState, element]);
  };
  const handleMouseMove = (event) => {
    if (!drawing) return;

    const { clientX, clientY } = event;

    const index = elements.length - 1;
    const { x1, y1 } = elements[index];
    const updatedElement = createElement(x1, y1, clientX, clientY, elementType);

    const copyelement = [...elements];
    copyelement[index] = updatedElement;
    setElement(copyelement);
  };
  const handleMouseUp = () => {
    setDrawing(false);
  };

  return (
    <div>
      <div style={{ position: "fixed" }}>
        <input
          type="radio"
          id="line"
          checked={elementType === "line"}
          onChange={() => setElementType("line")}
        />
        <label htmlFor="line">Line</label>
        <input
          type="radio"
          id="rectangle"
          checked={elementType === "rectangle"}
          onChange={() => setElementType("rectangle")}
        />
        <label htmlFor="rectangle">Rectangle</label>
      </div>
      <canvas
        id="canvas"
        width={window.innerWidth}
        height={window.innerHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        Canvas
      </canvas>
    </div>
  );
}

export default App;
