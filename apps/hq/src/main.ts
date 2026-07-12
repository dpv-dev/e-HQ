import App from "./app/App.svelte";
import { startCoreWebVitalsMonitoring } from "./app/rum.js";
import { mount } from "svelte";
import "./styles.css";

const target = document.getElementById("app");

if (target === null) {
  throw new Error("HQ app mount target #app was not found.");
}

const app = mount(App, { target });
startCoreWebVitalsMonitoring();

export default app;
