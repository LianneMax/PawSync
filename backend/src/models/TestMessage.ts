import mongoose, { Schema, Document } from 'mongoose';

export interface ITestMessage extends Document {
  message: string;
  createdAt: Date;
}

const TestMessageSchema = new Schema({
  message: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model<ITestMessage>('TestMessage', TestMessageSchema);