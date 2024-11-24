from .base_llm import BaseLLM
import time

# could be dynamically imported similar to other models

from pyopenagi.utils.chat_template import Response
from ...utils.utils import get_from_env

from transformers import AutoTokenizer

class vLLM(BaseLLM):

    def __init__(self, llm_name: str,
                 max_gpu_memory: dict = None,
                 eval_device: str = None,
                 max_new_tokens: int = 256,
                 log_mode: str = "console"):

        super().__init__(llm_name,
                         max_gpu_memory,
                         eval_device,
                         max_new_tokens,
                         log_mode)

    def load_llm_and_tokenizer(self) -> None:
        """ fetch the model from huggingface and run it """
        self.available_gpus = list(self.max_gpu_memory.keys())
        self.gpu_nums = len(self.available_gpus)
        try:
            import vllm
        except ImportError:
            raise ImportError(
                "Could not import vllm python package. "
                "Please install it with `pip install vllm`."
            )

        """ only casual lms for now """
        self.model = vllm.LLM(
            model = self.model_name,
            download_dir = get_from_env("HF_HOME"),
            tensor_parallel_size = self.gpu_nums
        )
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_name,
        )
        self.tokenizer.pad_token_id = self.tokenizer.eos_token_id

        self.sampling_params = vllm.SamplingParams(
            temperature=0.8,
            top_p=0.95,
            max_tokens=self.max_new_tokens,
        )

    def address_syscall(self,
                llm_syscall,
                temperature=0.0) -> None:
        llm_syscall.set_status("executing")
        llm_syscall.set_start_time(time.time())
        self.logger.log(
            f"{llm_syscall.agent_name} is switched to executing.\n",
            level = "executing"
        )

        messages = llm_syscall.request_data.messages
        tools = llm_syscall.request_data.tools
        message_return_type = llm_syscall.request_data.message_return_type

        if tools:
            messages = self.tool_calling_input_format(messages, tools)
            # print(messages)
            prompt = self.tokenizer.apply_chat_template(
                messages,
                # tools = tools,
                tokenize = False
            )
            # prompt = self.parse_messages(messages)
            response = self.model.generate(
                prompt, self.sampling_params
            )
            # print(response)
            result = response[0].outputs[0].text

            print(f"***** Result: {result} *****")

            tool_calls = self.parse_tool_calls(
                result
            )
            if tool_calls:
                llm_syscall.set_response(
                    Response(
                        response_message = None,
                        tool_calls = tool_calls
                    )
                )
            else:
                llm_syscall.set_response(
                    Response(
                        response_message = result
                    )
                )

        else:
            prompt = self.tokenizer.apply_chat_template(
                messages,
                tokenize = False
            )

            # prompt = self.parse_messages(messages)
            response = self.model.generate(
                prompt, self.sampling_params
            )

            result = response[0].outputs[0].text
            if message_return_type == "json":
                result = self.parse_json_format(result)

            llm_syscall.set_response(
                Response(
                    response_message=result
                )
            )

        llm_syscall.set_status("done")

        llm_syscall.set_end_time(time.time())
