// Dependencies
import * as React from "react";
import {
  Button,
  ButtonGroup,
  Input,
  InputGroup,
  InputGroupAddon,
  Label,
  ListGroup,
  ListGroupItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader
} from "reactstrap";
import { ISignal, Signal } from "@phosphor/signaling";
import ColorFunctions from "../ColorFunctions";

const INVALID_INPUT_MSG_DEFAULT: string =
  "The text entered is not valid. Please try again or cancel.";

const OPTIONS_HEADER_DEFAULT: string = "Recently Used:";

const listGroupStyle: React.CSSProperties = {
  margin: "10px",
  maxHeight: "250px",
  overflowY: "auto"
};

const listGroupItemStyle: React.CSSProperties = {
  overflowWrap: "break-word"
};

interface IInputModalProps {
  acceptText: string;
  cancelText: string;
  message: string;
  onModalClose: (input: string, savedInput: string[]) => void;
  placeHolder: string;
  title: string;
  inputListHeader?: string;
  inputOptions?: string[];
  invalidInputMessage?: string;
  isValid?: (input: string) => boolean;
  sanitizer?: (input: string) => string;
}

interface IInputModalState {
  modalOpen: boolean; // Whether a modal is currently open
  input: string; // The current string input in the modal
  savedInput: string[]; // The list of input options aviailable
  showSaved: boolean; // Whether to show a list of saved input
  isValid: boolean; // Set to true if current input is valid
}

export default class InputModal extends React.Component<
  IInputModalProps,
  IInputModalState
> {
  private _savedChanged: Signal<this, string[]>;
  constructor(props: IInputModalProps) {
    super(props);
    this.state = {
      input: "",
      isValid: this.props.isValid ? this.props.isValid("") : true,
      modalOpen: false,
      savedInput: this.props.inputOptions
        ? this.props.inputOptions
        : Array<string>(),
      showSaved: this.props.inputOptions ? true : false
    };
    this.show = this.show.bind(this);
    this._savedChanged = new Signal<this, string[]>(this);
    this.saveInput = this.saveInput.bind(this);
    this.deleteInput = this.deleteInput.bind(this);
    this.hide = this.hide.bind(this);
    this.toggle = this.toggle.bind(this);
    this.reset = this.reset.bind(this);
    this.onInputUpdate = this.onInputUpdate.bind(this);
    this.clickSavedInput = this.clickSavedInput.bind(this);
  }

  get savedOptionsChanged(): ISignal<this, string[]> {
    return this._savedChanged;
  }

  public async show(): Promise<void> {
    await this.setState({ modalOpen: true });
  }

  public async toggle(): Promise<void> {
    await this.setState({ modalOpen: !this.state.modalOpen });
  }

  public async reset(): Promise<void> {
    await this.setState({
      input: "",
      isValid: this.props.isValid ? this.props.isValid("") : true
    });
  }

  public render(): JSX.Element {
    const colors: string[] = ColorFunctions.createGradient(
      this.state.savedInput.length,
      "#e30008",
      "#7000ad"
    );
    return (
      <Modal
        isOpen={this.state.modalOpen}
        toggle={this.toggle}
        size="lg"
        onClosed={this.reset}
      >
        <ModalHeader>{this.props.title}</ModalHeader>
        <ModalBody
          className={
            /*@tag<text-muted popup-input-modal>*/ "text-muted popup-input-modal-vcdat"
          }
        >
          {this.state.input === ""
            ? this.props.message
            : this.state.isValid
            ? ""
            : this.props.invalidInputMessage
            ? this.props.invalidInputMessage
            : INVALID_INPUT_MSG_DEFAULT}
          <InputGroup>
            <Input
              id={/*@tag<input-modal-input>*/ "input-modal-input-vcdat"}
              onChange={this.onInputUpdate}
              placeholder={this.props.placeHolder}
              value={this.state.input}
            />
            {this.state.showSaved && (
              <Button
                disabled={!this.state.isValid}
                color="success"
                onClick={this.saveInput}
              >
                Save
              </Button>
            )}
          </InputGroup>
          {this.state.savedInput && this.state.savedInput.length > 0 && (
            <ListGroup
              style={listGroupStyle}
              className={
                /*@tag<popup-input-options-list>*/ "popup-input-options-list-vcdat"
              }
            >
              {this.props.inputListHeader
                ? this.props.inputListHeader
                : OPTIONS_HEADER_DEFAULT}
              {this.state.savedInput.map((item: string, idx: number) => {
                const clickSavedInput = () => {
                  this.clickSavedInput(item);
                };
                const deleteInput = (
                  event: React.MouseEvent<any, MouseEvent>
                ) => {
                  event.stopPropagation();
                  this.deleteInput(idx);
                };
                return (
                  <ListGroupItem
                    key={idx}
                    action={true}
                    style={listGroupItemStyle}
                    onClick={clickSavedInput}
                    className="clear-fix"
                  >
                    {item}
                    <Button
                      className="float-right"
                      style={{ backgroundColor: colors[idx] }}
                      onClick={deleteInput}
                    >
                      X
                    </Button>
                  </ListGroupItem>
                );
              })}
            </ListGroup>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            className={
              /*@tag<popup-input-modal-btn>*/ "popup-input-modal-btn-vcdat"
            }
            outline={!this.state.input}
            color={this.state.isValid ? "info" : "danger"}
            onClick={this.hide}
          >
            {this.state.isValid ? this.props.acceptText : this.props.cancelText}
          </Button>
        </ModalFooter>
      </Modal>
    );
  }

  private async saveInput(): Promise<void> {
    const newList: string[] = this.state.savedInput;
    newList.push(this.state.input);
    await this.setState({ savedInput: newList });
    this._savedChanged.emit(this.state.savedInput); // Publish that saved options changed
  }

  private async deleteInput(index: number): Promise<void> {
    const newList: string[] = this.state.savedInput;
    newList.splice(index, 1);
    await this.setState({ savedInput: newList });
    this._savedChanged.emit(this.state.savedInput); // Publish that saved options changed
  }

  private async clickSavedInput(savedInput: string): Promise<void> {
    this.validate(savedInput.concat(this.state.input));
  }

  private async hide(): Promise<void> {
    // If the input was not valid, cancel hide operation with message
    if (this.state.isValid) {
      this.props.onModalClose(this.state.input, this.state.savedInput);
    }

    await this.setState({ modalOpen: false, input: "" });
  }

  private async validate(input: string): Promise<void> {
    let newInput: string = input;
    // Clean input if necessary
    if (this.props.sanitizer) {
      newInput = this.props.sanitizer(newInput);
    }

    // Validat input if necessary
    if (this.props.isValid) {
      await this.setState({ isValid: this.props.isValid(newInput) });
    } else {
      this.setState({ isValid: true });
    }

    // Update current input state
    await this.setState({ input: newInput });
  }

  private async onInputUpdate(
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> {
    this.validate(event.target.value);
  }
}
