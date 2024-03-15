import { useEffect, useLayoutEffect, useState } from "react";
import rough from "roughjs";
import { getStroke } from "perfect-freehand";

const generator = rough.generator();

function createElement(id, x1, y1, x2, y2, type) {
  switch (type) {
    case "line":
    case "rectangle":
      const roughElement =
        type === "line"
          ? generator.line(x1, y1, x2, y2)
          : generator.rectangle(x1, y1, x2 - x1, y2 - y1);
      return { id, x1, y1, x2, y2, type, roughElement };
    case "pencil":
      return { id, type, points: [{ x: x1, y: y1 }] };
    default:
      throw new Error(`Type not defined ${type}`);
  }
}

const nearPoint = (x, y, x1, y1, name) => {
  return Math.abs(x - x1) < 5 && Math.abs(y - y1) < 5 ? name : null;
};

const onLine = (x1, y1, x2, y2, x, y, maxDistance = 1) => {
  const a = { x: x1, y: y1 };
  const b = { x: x2, y: y2 };
  const c = { x, y };
  const offSet = distance(a, b) - (distance(a, c) + distance(b, c));

  return Math.abs(offSet) < maxDistance ? "inside" : null;
};

function positionWithinElement(x, y, element) {
  const { type, x1, x2, y1, y2 } = element;
  switch (type) {
    case "line":
      onLine(x1, y1, x2, y2, x, y);
      const start = nearPoint(x, y, x1, y1, "start");
      const end = nearPoint(x, y, x2, y2, "end");
      const insideLine = Math.abs(offSet) < 1 ? "inside" : null;
      return start || end || insideLine;
    case "rectangle":
      const topLeft = nearPoint(x, y, x1, y1, "TL");
      const topRight = nearPoint(x, y, x2, y1, "TR");
      const bottomLeft = nearPoint(x, y, x1, y2, "BL");
      const bottomRight = nearPoint(x, y, x2, y2, "BR");
      const inside = x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside" : null;
      return topLeft || inside || topRight || bottomLeft || bottomRight;
    case "pencil":
      const betweenAnyPoint = element.points.some((point, index) => {
        const nextPoint = element.points[index + 1];
        if (!nextPoint) return false;
        return (
          onLine(point.x, point.y, nextPoint.x, nextPoint.y, x, y, 5) != null
        );
      });
      return betweenAnyPoint ? "inside" : null;
    default:
      throw new Error(`Type not defined ${type}`);
  }
}

const distance = (a, b) => {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
};

function getElementAtPosition(x, y, elements) {
  return elements
    .map((element) => ({
      ...element,
      position: positionWithinElement(x, y, element),
    }))
    .find((element) => element.position !== null);
}

const adjustElementCoordinates = (element) => {
  const { type, x1, y1, x2, y2 } = element;

  if (type === "rectangle") {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    return { x1: minX, y1: minY, x2: maxX, y2: maxY };
  } else {
    if (x1 < x2 || (x1 === x2 && y1 < y2)) {
      return { x1, y1, x2, y2 };
    } else {
      return { x1: x2, y1: y2, x2: x1, y2: y1 };
    }
  }
};

const cursorForPosition = (position) => {
  switch (position) {
    case "TL":
    case "BR":
    case "start":
    case "end":
      return "nwse-resize";
    case "TR":
    case "BL":
      return "nesw-resize";
    default:
      return "grab";
  }
};

const resizedCoordinates = (clientX, clientY, position, coordinates) => {
  const { x1, y1, x2, y2 } = coordinates;
  switch (position) {
    case "TL":
    case "start":
      return { x1: clientX, y1: clientY, x2, y2 };
    case "TR":
      return { x1, y1: clientY, x2: clientX, y2 };
    case "BL":
      return { x1: clientX, y1, x2, y2: clientY };
    case "BR":
    case "end":
      return { x1, y1, x2: clientX, y2: clientY };
    default:
      return null;
  }
};

const useHistory = (intialState) => {
  const [index, setIndexx] = useState(0);
  const [history, setHistory] = useState([intialState]);

  const setState = (action, overwrite = false) => {
    const newState =
      typeof action === "function" ? action(history[index]) : action;
    if (overwrite) {
      const historyCopy = [...history];
      historyCopy[index] = newState;
      setHistory(historyCopy);
    } else {
      const updatedState = [...history].slice(0, index + 1);

      setHistory([...updatedState, newState]);
      setIndexx((prevState) => prevState + 1);
    }
  };
  const undo = () => {
    index > 0 && setIndexx((prevState) => prevState - 1);
  };
  const redo = () => {
    index < history.length - 1 && setIndexx((prevState) => prevState + 1);
  };
  return [history[index], setState, undo, redo];
};

function getSvgPathFromStroke(stroke) {
  if (!stroke.length) return "";

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );

  d.push("Z");
  return d.join(" ");
}

const drawElement = (roughCanvas, context, element) => {
  switch (element.type) {
    case "line":
    case "rectangle":
      roughCanvas.draw(element.roughElement);
      break;
    case "pencil":
      const stroke = getSvgPathFromStroke(
        getStroke(element.points, {
          size: 24,
        })
      );
      context.fill(new Path2D(stroke));
      break;
    default:
      throw new Error(`Type not defined ${element.type}`);
  }
};

const adjustmentRequired = (type) => ["line", "rectangle"].includes(type);

function App() {
  const [elements, setElement, undo, redo] = useHistory([]);
  const [action, setAction] = useState("none");
  const [tool, setTool] = useState("pencil");
  const [selectedElement, setSelectedElement] = useState(null);
  useLayoutEffect(() => {
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");

    context.clearRect(0, 0, canvas.width, canvas.height);

    const roughCanvas = rough.canvas(canvas);
    elements.forEach((element) => drawElement(roughCanvas, context, element));
  }, [elements]);

  useEffect(() => {
    const undoRedoFunction = (event) => {
      if ((event.metaKey || event.ctrlKey) && (event.key === "z" || event.key === "Z")) {
        undo();
      }
      if ((event.metaKey || event.ctrlKey) && (event.key === "y" || event.key === "Y")) {
        redo();
      }
    };
    document.addEventListener("keydown", undoRedoFunction);
    return () => {
      document.removeEventListener("keydown", undoRedoFunction);
    };
  }, [undo, redo]);

  const updateElement = (id, x1, y1, x2, y2, type) => {
    const copyelement = [...elements];
    switch (type) {
      case "line":
      case "rectangle":
        copyelement[id] = createElement(id, x1, y1, x2, y2, type);
        break;
      case "pencil":
        copyelement[id].points = [...copyelement[id].points, { x: x2, y: y2 }];
        break;
      default:
        throw new Error(`Type not defined ${type}`);
    }
    setElement(copyelement, true);
  };

  const handleMouseDown = (event) => {
    const { clientX, clientY } = event;
    if (tool === "selection") {
      const element = getElementAtPosition(clientX, clientY, elements);
      if (element) {
        if (element.type === "pencil") {
          const xOffSet = element.points.map((point) => clientX - point.x);
          const yOffSet = element.points.map((point) => clientY - point.y);
          setSelectedElement({ ...element, xOffSet, yOffSet });
        } else {
          const offSetX = clientX - element.x1;
          const offSetY = clientY - element.y1;
          setSelectedElement({ ...element, offSetX, offSetY });
        }
        setElement((prevState) => prevState);
        if (element.position === "inside") {
          setAction("moving");
        } else {
          setAction("resize");
        }
      }
    } else {
      const id = elements.length;
      const element = createElement(
        id,
        clientX,
        clientY,
        clientX,
        clientY,
        tool
      );
      setElement((prevState) => [...prevState, element]);
      setSelectedElement(element);
      setAction("drawing");
    }
  };

  const handleMouseMove = (event) => {
    const { clientX, clientY } = event;
    if (tool === "selection") {
      const element = getElementAtPosition(clientX, clientY, elements);
      event.target.style.cursor = element
        ? cursorForPosition(element.position)
        : "default";
    }
    if (action === "drawing") {
      const index = elements.length - 1;
      const { x1, y1 } = elements[index];
      updateElement(index, x1, y1, clientX, clientY, tool);
    } else if (action === "moving") {
      if (selectedElement.type === "pencil") {
        const { id } = selectedElement;
        const newPoints = selectedElement.points.map((_, index) => {
          return {
            x: clientX - selectedElement.xOffSet[index],
            y: clientY - selectedElement.yOffSet[index],
          };
        });
        const copyelement = [...elements];
        copyelement[id] = {
          ...copyelement[id],
          points: newPoints,
        };
        setElement(copyelement, true);
      } else {
        const { id, x1, y1, x2, y2, type, offSetX, offSetY } = selectedElement;
        const width = x2 - x1;
        const height = y2 - y1;
        const newX1 = clientX - offSetX;
        const newY1 = clientY - offSetY;
        updateElement(id, newX1, newY1, newX1 + width, newY1 + height, type);
      }
    } else if (action === "resize") {
      const { id, type, position, ...coordinates } = selectedElement;
      const { x1, y1, x2, y2 } = resizedCoordinates(
        clientX,
        clientY,
        position,
        coordinates
      );
      updateElement(id, x1, y1, x2, y2, type);
    }
  };
  const handleMouseUp = () => {
    if (selectedElement) {
      const index = selectedElement.id;
      const { id, type } = elements[index];
      if (
        (action === "drawing" || action === "resize") &&
        adjustmentRequired(type)
      ) {
        const { x1, y1, x2, y2 } = adjustElementCoordinates(elements[index]);
        updateElement(id, x1, y1, x2, y2, type);
      }
    }
    setAction("none");
    setSelectedElement(null);
  };

  return (
    <div>
      <div style={{ position: "fixed" }}>
        <input
          type="radio"
          id="selection"
          checked={tool === "selection"}
          onChange={() => setTool("selection")}
        />
        <label htmlFor="selection">Selection</label>
        <input
          type="radio"
          id="line"
          checked={tool === "line"}
          onChange={() => setTool("line")}
        />
        <label htmlFor="line">Line</label>
        <input
          type="radio"
          id="rectangle"
          checked={tool === "rectangle"}
          onChange={() => setTool("rectangle")}
        />
        <label htmlFor="rectangle">Rectangle</label>
        <input
          type="radio"
          id="pencil"
          checked={tool === "pencil"}
          onChange={() => setTool("pencil")}
        />
        <label htmlFor="pencil">Pencil</label>
      </div>
      <div style={{ position: "fixed", bottom: 0 }}>
        <button onClick={undo}> Undo</button>
        <button onClick={redo}> Redo</button>
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
