// What the reviewer's session says about itself in the action's execution file, the JSON list of its messages: the
// models that served it. The review names them, so a stand-in for the requested model is never silent.
import { modelIsRecord } from '../../src/react/preview3d/recordModel.ts';

const refuse = (expected: string): never => {
  throw new Error(`execution file: ${expected}.`);
};

/** The models the session's result message says it used, in the order it lists them. */
export function readModels(json: string): string[] {
  let messages: unknown;
  try {
    messages = JSON.parse(json);
  } catch {
    return refuse('must be JSON');
  }
  if (!Array.isArray(messages)) return refuse('must be a list of messages');
  const result = messages.find(message => modelIsRecord(message) && message.type === 'result');
  const usage = modelIsRecord(result) ? result.modelUsage : undefined;
  const models = modelIsRecord(usage) ? Object.keys(usage) : [];
  return models.length ? models : refuse('must hold a result message that names the models it used');
}
