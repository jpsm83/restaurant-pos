import { render, screen } from "@testing-library/react";
import { FieldError } from "../FieldError";

describe("FieldError", () => {
  it("renders nothing when message is undefined", () => {
    const { container } = render(<FieldError message={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when message is empty string", () => {
    const { container } = render(<FieldError message="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the message with alert role when provided", () => {
    render(<FieldError message="Something went wrong" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong");
    expect(alert).toHaveClass("text-red-600");
  });
});
