import React, { Component } from 'react'
import Slider from 'react-rangeslider'
import { getStatus, setFlagPosition, setTopLedFunction, setBottomLedFunction } from './Service'

import './App.css'

import 'react-rangeslider/lib/index.css'

let io = require('socket.io-client')
let socket = io()

class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      hostName: "",
      flagPosition: {
        current: 0,
        next: 0
      },
      nextPosition: 0,
      topLed: 'Off',
      bottomLed: 'Off'
    }
  }

  componentDidMount() {
    socket.on('flagPosition', this.updateFlagPosition.bind(this))
    socket.on('topLed', this.updateTopLedFunction.bind(this))
    socket.on('bottomLed', this.updateBottomLedFunction.bind(this))

    getStatus().then((status) => {
      this.setState({
        hostName: status.hostName,
        flagPosition: status.flagPosition,
        nextPosition: parseInt(status.flagPosition.next, 10),
        topLed: status.rgbLedFunction,
        bottomLed: status.neoPixelFunction
      })
    })
  }

  updateFlagPosition(flagPosition) {
    this.setState({
      flagPosition
    })
  }

  updateTopLedFunction(topLedFunction) {
    this.setState({
      topLed: topLedFunction
    })
  }

  updateBottomLedFunction(bottomLedFunction) {
    this.setState({
      bottomLed: bottomLedFunction
    })
  }

  setFlagPosition(e, position) {
    setFlagPosition(position)
  }

  handlePositionChange = (value) => {
    this.setState({
      nextPosition: value
    })
  }

  handleTopLedFunctionChange = (changeEvent) => {
    this.setState({
      topLed: changeEvent.target.value,
    })
  }

  setTopLedFunction(e, topLedFunction) {
    setTopLedFunction(topLedFunction)
  }

  handleBottomLedFunctionChange = (changeEvent) => {
    this.setState({
      bottomLed: changeEvent.target.value
    });
  }

  setBottomLedFunction(e, bottomLedFunction) {
    setBottomLedFunction(bottomLedFunction)
  }

  render() {
    let { nextPosition } = this.state
    return (
      <div className="App">
        <div className="App-header">
          <h2>{this.state.hostName}</h2>
        </div>
        <div className="FlagContainer">
          <div className="Container">
            <div className="Information">Current Flag position: {this.state.flagPosition.current}.</div>
            <div className="Information">Next Flag position: {this.state.flagPosition.next}.</div>
          </div>
          <Slider className="Slider" width="100%"
            value={nextPosition}
            onChange={this.handlePositionChange}
          />
          <button onClick={e => this.setFlagPosition(e, this.state.nextPosition)}>Set Flag position</button>
        </div>
        <div className="TopLedContainer">
          <div className="TopInformation">Top Led function: {this.state.topLed}.</div>
          <form className="TopForm">
            <div className="radio">
              <label>
                <input type="radio" value="Off"
                  checked={this.state.topLed === 'Off'}
                  onChange={this.handleTopLedFunctionChange} />
                Off
              </label>
            </div>
            <div className="radio">
              <label>
                <input type="radio" value="On"
                  checked={this.state.topLed === 'On'}
                  onChange={this.handleTopLedFunctionChange} />
                On
              </label>
            </div>
            <div className="radio">
              <label>
                <input type="radio" value="Rotate"
                  checked={this.state.topLed === 'Rotate'}
                  onChange={this.handleTopLedFunctionChange} />
                Rotate
              </label>
            </div>
            <div className="radio">
              <label>
                <input type="radio" value="Blink"
                  checked={this.state.topLed === 'Blink'}
                  onChange={this.handleTopLedFunctionChange} />
                Blink
              </label>
            </div>
          </form>
          <button onClick={e => this.setTopLedFunction(e, this.state.topLed)}>Set Top Led function</button>
        </div>
        <div className="BottomLedContainer">
          <div className="BottomInformation">Bottom Led function: {this.state.bottomLed}.</div>
          <form className="BottomForm">
            <div className="radio">
              <label>
                <input type="radio" value="Off"
                  checked={this.state.bottomLed === 'Off'}
                  onChange={this.handleBottomLedFunctionChange} />
                Off
            </label>
            </div>
            <div className="radio">
              <label>
                <input type="radio" value="On"
                  checked={this.state.bottomLed === 'On'}
                  onChange={this.handleBottomLedFunctionChange} />
                On
            </label>
            </div>
            <div className="radio">
              <label>
                <input type="radio" value="Rotate"
                  checked={this.state.bottomLed === 'Rotate'}
                  onChange={this.handleBottomLedFunctionChange} />
                Rotate
            </label>
            </div>
            <div className="radio">
              <label>
                <input type="radio" value="Blink"
                  checked={this.state.bottomLed === 'Blink'}
                  onChange={this.handleBottomLedFunctionChange} />
                Blink
            </label>
            </div>
          </form>
          <button onClick={e => this.setBottomLedFunction(e, this.state.bottomLed)}>Set Bottom Led function</button>
        </div>
      </div>
    );
  }
}

export default App;
