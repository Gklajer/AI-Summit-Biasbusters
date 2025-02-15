import dotenv

from RealtimeSTT import AudioToTextRecorder
import json
import os
from pydantic import BaseModel
from mistralai import Mistral
from typing import Optional
from typing import Any

dotenv.load_dotenv()


FIRST_AID_PROMPT_DIRPATH = os.path.join(os.path.dirname(__file__), "first-aid-prompt")
GUIDE_FILEPATH = os.path.join(FIRST_AID_PROMPT_DIRPATH, "guide.txt")
FUNCTIONS_FILEPATH = os.path.join(FIRST_AID_PROMPT_DIRPATH, "functions.json")
USER_EXAMPLE_FILEPATH = os.path.join(FIRST_AID_PROMPT_DIRPATH, "user-example.txt")

ASSISTANT_PROMPT_RECOMMANDATION = "You should systematically ask for more context information if the user's input is ambiguous or incomplete. Don't take any risk with first aid."

with open(GUIDE_FILEPATH) as f:
    ASSISTANT_PROMPT_REFERENCE_GUIDE = (
        f"Use the following reference guide to complete the task:\n{f.read()}"
    )

with open(FUNCTIONS_FILEPATH) as f:
    FIRST_AID_FUNCTIONS = json.load(f)["functions"]
    ASSISTANT_PROMPT_LIST_FUNCTIONS = f"I have a list of first aid functions, each with a description and expected arguments. Based on a user's input, I want to choose the appropriate function to call. The list of available functions is as follows:\n{FIRST_AID_FUNCTIONS}"

SYSTEM_PROMPT = f"{ASSISTANT_PROMPT_REFERENCE_GUIDE}\n\n{ASSISTANT_PROMPT_LIST_FUNCTIONS}\n\n{ASSISTANT_PROMPT_RECOMMANDATION}"


class Function(BaseModel):
    name: str
    description: str
    arguments: dict[str, Any]


class LLMAssistant:

    def __init__(
        self,
        client=Mistral(api_key=os.environ["MISTRAL_API_KEY"]),
        system_prompt=SYSTEM_PROMPT,
    ):
        self.client = client
        self.history = [{"role": "system", "content": system_prompt}]
        self.system_prompt = system_prompt

    def chat(
        self,
        prompt: Optional[str],
        model: str = "mistral-small-latest",
        response_format=Function,
        max_tokens: int = 100000,
        temperature: int = 0,
    ) -> str:
        if not prompt:
            return ""

        self.history += [{"role": "user", "content": prompt}]
        print(prompt)

        var = (
            self.client.chat.parse(
                model=model,
                messages=self.history,
                response_format=response_format,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            .choices[0]
            .message.content
        )
        print(var)
        return var

if __name__ == "__main__":
    recorder_config = {
        # "spinner": False,
        # "use_microphone": False,
        "model": "small",
        "language": "fr",
        "silero_sensitivity": 0.4,
        "webrtc_sensitivity": 2,
        "post_speech_silence_duration": 0.2,
        "min_length_of_recording": 0,
        "min_gap_between_recordings": 0,
        "enable_realtime_transcription": True,
        "realtime_processing_pause": 0,
        "realtime_model_type": "tiny",
    }

    recorder = AudioToTextRecorder(**recorder_config)
    llm = LLMAssistant()

    while True:
        print(recorder.text(llm.chat))
